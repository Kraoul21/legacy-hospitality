"""Serveur du site Legacy Hospitality Group + assistant de conciergerie Shelter&Co.

- Sert les pages du site (index.html, shelter-co.html, …).
- POST /api/chat : relaie la conversation à Claude et renvoie la réponse
  en streaming (Server-Sent Events) à la page conciergerie-ia.html.
- GET /api/calendrier.ics : renvoie l'événement du séjour au format calendrier,
  pour qu'iPhone, iPad et Mac l'ouvrent directement dans Calendrier.
- POST /api/welcome : reçoit les demandes particulières du formulaire
  welcome.html, les enregistre dans .demandes/ et les envoie par e-mail
  à la réception.

E-mail de la réception (variables d'environnement) :
    RECEPTION_EMAIL   adresse qui reçoit les demandes
    SMTP_HOST         serveur d'envoi (ex. smtp.gmail.com, ssl0.ovh.net…)
    SMTP_PORT         465 (SSL) ou 587 (STARTTLS) — 587 par défaut
    SMTP_USER         identifiant du compte d'envoi
    SMTP_PASSWORD     mot de passe (ou mot de passe d'application)
    SMTP_FROM         expéditeur (par défaut SMTP_USER)
Sans ces variables, les demandes sont seulement enregistrées dans .demandes/.

La clé API reste côté serveur (variable d'environnement ANTHROPIC_API_KEY),
elle n'est jamais envoyée au navigateur.

Lancement :
    export ANTHROPIC_API_KEY="sk-ant-..."
    .venv/bin/python serveur.py          # http://localhost:8347
"""

import json
import os
import re
import secrets
import smtplib
import ssl
import sys
import threading
import time
from datetime import datetime
from email.message import EmailMessage
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import anthropic

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8347"))
MODEL = "claude-opus-5-5"

MAX_TURNS = 30            # messages conservés dans l'historique envoyé
MAX_CHARS = 2000          # longueur maximale d'un message client
MAX_BODY = 200_000        # taille maximale d'une requête (octets)

# --- Formulaire Welcome ------------------------------------------------------
DEMANDES = ROOT / ".demandes"          # dossier caché : jamais servi au navigateur
WELCOME_TYPES = [
    "Heure d'arrivée",
    "Occasion spéciale",
    "Oreillers & literie",
    "Allergies & régime",
    "Transfert aéroport",
    "Lit bébé",
    "Autre",
]
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
RATE_WINDOW, RATE_MAX = 600, 5         # 5 demandes max par adresse IP et par 10 min
_rate = {}
_rate_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Connaissances de l'assistant — données de démonstration, à remplacer par
# les vraies informations de l'hôtel et la vraie base de réservations.
# ---------------------------------------------------------------------------

HOTEL = """\
Hôtel : Shelter&Co, membre de Legacy Hospitality Group.
Adresse : 24 rue Charlot, 75003 Paris, France — au cœur du Haut-Marais.
Accès : métro Filles du Calvaire et Saint-Sébastien–Froissart (ligne 8) à 4–5 minutes à pied,
Arts et Métiers (lignes 3 et 11) à 7 minutes, République à 10 minutes ; gare de Lyon et
gare du Nord à environ 15 minutes en taxi ; aéroport Charles-de-Gaulle à environ 45 minutes,
Orly à environ 40 minutes.
Quartier : le Haut-Marais — galeries d'art, créateurs et concept stores, marché des
Enfants-Rouges (rue de Bretagne), place des Vosges, musée Picasso et musée Carnavalet,
bars à cocktails de la rue Charlot et de la rue Vieille-du-Temple, rue des Rosiers.
Style : hôtel boutique au style brutaliste (béton brut, murs blancs, touches de bleu),
chambres aux derniers étages avec vue sur les toits de Paris et la tour Eiffel.

Horaires :
- Check-in à partir de 15:00. Check-out standard avant 11:00.
- Petit-déjeuner : 7:00–10:30 en semaine, 7:30–11:00 le week-end, au rez-de-chaussée.
- Rooftop bar (dernier étage) : 18:00–1:00, accès réservé aux membres Gold.
- Spa (sauna, hammam, soins) : 9:00–21:00, sur réservation auprès de la réception.
- Salle de sport : ouverte 24 h/24 avec la carte de chambre.
- Réception et conciergerie : 24 h/24, numéro 9 depuis le téléphone de la chambre.

Services :
- Wi-Fi gratuit dans tout l'hôtel (réseau « Shelter&Co », sans mot de passe ; le Wi-Fi
  premium très haut débit est inclus pour les membres Silver et Gold).
- Room service : 7:00–23:00, via le téléphone de la chambre.
- Parking : pas de parking dans l'hôtel ; parking public partenaire à 200 m (tarif réduit
  sur présentation de la carte de chambre).
- Bagagerie gratuite avant le check-in et après le check-out.
- Animaux : chiens de moins de 10 kg acceptés sur demande.
- Hôtel entièrement non-fumeur.

Programme de fidélité :
- Silver (à partir de 5 000 points) : late check-out jusqu'à 14:00, petit-déjeuner offert,
  Wi-Fi premium, surclassement sur demande selon disponibilité.
- Gold (à partir de 15 000 points) : avantages Silver + accès au rooftop bar.
"""

RESERVATIONS = {
    "012345": """\
Réservation n° 012345.
Chambre 412 — Suite Deluxe (38 m², 2 adultes), au dernier étage, vue tour Eiffel.
Arrivée : lundi 12 octobre 2026, à partir de 15:00.
Départ : jeudi 15 octobre 2026, avant 14:00 (late check-out, avantage membre Silver).
Durée : 3 nuits.
Statut fidélité : membre Silver, 12 480 points (2 520 points avant le statut Gold).
Avantages : late check-out 14:00, petit-déjeuner offert, Wi-Fi premium, surclassement sur demande.
Bons cadeaux : Spa −20 % (valable jusqu'au 31 déc. 2026) ; dîner pour deux (valable jusqu'au 15 oct. 2026).
Portefeuille : 1 500 Legacy Points disponibles (monnaie virtuelle de LHG, 1 € = 10 Legacy Points).
""",
}

SYSTEM_TEMPLATE = """\
Tu es l'assistant de conciergerie de l'hôtel Shelter&Co, dans l'espace client en ligne.
Tu réponds aux questions des clients sur l'hôtel, leur séjour, les services, le quartier
et Paris. Ton ton est chaleureux, élégant et concis, comme un concierge d'hôtel haut de gamme.

Règles :
- Tu réponds uniquement aux questions : tu ne peux pas réserver, modifier, annuler ni
  commander quoi que ce soit. Si le client veut agir (réserver le spa, commander, changer
  ses dates…), explique-lui comment faire : appeler la réception (numéro 9 depuis la chambre,
  ou sur place 24 h/24).
- Appuie-toi sur les informations ci-dessous. Si une information n'y figure pas, dis-le
  simplement et propose de se renseigner auprès de la réception plutôt que d'inventer.
- Pour Paris et le quartier, tu peux donner des conseils généraux ; précise alors qu'il vaut
  mieux vérifier horaires et disponibilités.
- Réponds dans la langue du client. Réponses courtes : 1 à 4 phrases le plus souvent.
- Écris en texte simple, sans Markdown (pas de titres, d'astérisques ni de tableaux).
  Tu peux aller à la ligne pour une courte liste.

<hotel>
{hotel}
</hotel>

<reservation_du_client>
{reservation}
</reservation_du_client>
"""

client = anthropic.Anthropic()  # lit ANTHROPIC_API_KEY dans l'environnement


def system_prompt(ref):
    reservation = RESERVATIONS.get(ref or "", "Aucune réservation associée à cette session.")
    return SYSTEM_TEMPLATE.format(hotel=HOTEL, reservation=reservation)


def clean_history(raw):
    """Valide l'historique envoyé par le navigateur (données non fiables)."""
    if not isinstance(raw, list) or not raw:
        raise ValueError("Conversation vide.")
    messages = []
    for m in raw[-MAX_TURNS:]:
        if not isinstance(m, dict) or m.get("role") not in ("user", "assistant"):
            raise ValueError("Message invalide.")
        text = m.get("content")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Message invalide.")
        messages.append({"role": m["role"], "content": text[:MAX_CHARS]})
    # l'API attend une conversation qui commence et finit par le client
    while messages and messages[0]["role"] != "user":
        messages.pop(0)
    if not messages or messages[-1]["role"] != "user":
        raise ValueError("Le dernier message doit venir du client.")
    return messages


def one_line(value, limit):
    """Texte sur une ligne (pas de retour chariot : protège les en-têtes d'e-mail)."""
    return re.sub(r"[\r\n\t]+", " ", str(value or "")).strip()[:limit]


def clean_welcome(data):
    """Valide le formulaire Welcome (données envoyées par le navigateur, non fiables)."""
    if not isinstance(data, dict):
        raise ValueError("Requête invalide.")
    ref = one_line(data.get("ref"), 32)
    arrival = one_line(data.get("arrival"), 5)
    message = str(data.get("message") or "").strip()[:2000]
    types = data.get("types") or []
    if not isinstance(types, list):
        raise ValueError("Requête invalide.")
    types = [t for t in WELCOME_TYPES if t in types]

    # le client est identifié par sa réservation : pas besoin de ressaisir ses coordonnées
    if ref not in RESERVATIONS:
        raise ValueError("Réservation introuvable. Merci de passer par votre espace client.")
    if arrival and not TIME_RE.match(arrival):
        raise ValueError("L'heure d'arrivée doit être au format HH:MM.")
    if not types and not message:
        raise ValueError("Choisissez au moins un type de demande ou écrivez un message.")
    if data.get("consent") is not True:
        raise ValueError("Merci d'accepter la transmission de votre demande à la réception.")

    return {
        "reservation": ref,
        "heure_arrivee": arrival,
        "types": types,
        "message": message,
    }


def rate_ok(ip):
    now = time.time()
    with _rate_lock:
        hits = [t for t in _rate.get(ip, []) if now - t < RATE_WINDOW]
        if len(hits) >= RATE_MAX:
            _rate[ip] = hits
            return False
        hits.append(now)
        _rate[ip] = hits
        return True


def smtp_configured():
    return all(os.environ.get(k) for k in ("RECEPTION_EMAIL", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"))


def send_welcome_email(d):
    msg = EmailMessage()
    msg["Subject"] = f"[Welcome] Demande {d['id']} — réservation {d['reservation']}"
    msg["From"] = os.environ.get("SMTP_FROM") or os.environ["SMTP_USER"]
    msg["To"] = os.environ["RECEPTION_EMAIL"]
    msg.set_content(
        "Nouvelle demande particulière envoyée depuis l'espace client Shelter&Co.\n\n"
        f"Demande        : {d['id']}\n"
        f"Reçue le       : {d['recue_le'].replace('T', ' à ')}\n"
        f"Réservation    : {d['reservation']}\n"
        f"Heure d'arrivée: {d['heure_arrivee'] or '—'}\n"
        f"Type(s)        : {', '.join(d['types']) or '—'}\n\n"
        "Message :\n"
        f"{d['message'] or '—'}\n\n"
        "Les coordonnées du client figurent dans la réservation.\n"
    )
    port = int(os.environ.get("SMTP_PORT", "587"))
    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(os.environ["SMTP_HOST"], port, context=context, timeout=20) as smtp:
            smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(os.environ["SMTP_HOST"], port, timeout=20) as smtp:
            smtp.starttls(context=context)
            smtp.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
            smtp.send_message(msg)


ICS_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$")

# Fuseau de Paris (heure d'été / d'hiver), pour que l'heure soit juste dans tous les calendriers
ICS_TZ_PARIS = [
    "BEGIN:VTIMEZONE", "TZID:Europe/Paris",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST",
    "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET",
    "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    "END:VTIMEZONE",
]


def ics_text(value, limit):
    """Texte d'un champ de calendrier : longueur limitée, caractères spéciaux échappés."""
    text = str(value or "")[:limit].replace("\r", "")
    return (text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
                .replace("\n", "\\n"))


def build_ics(q):
    """Construit l'événement à partir des paramètres envoyés par la page Mon séjour."""
    def one(name):
        return (q.get(name) or [""])[0]
    start, end = ICS_DATE_RE.match(one("start")), ICS_DATE_RE.match(one("end"))
    if not start or not end:
        raise ValueError("Dates invalides.")
    fmt = lambda m: "{}{}{}T{}{}00".format(*m.groups())
    uid = re.sub(r"[^A-Za-z0-9-]", "", one("uid"))[:32] or "sejour"
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Legacy Hospitality Group//Shelter&Co//FR",
        "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
        # nom affiché quand Calendrier (Mac) ajoute le séjour via un lien webcal://
        "X-WR-CALNAME:Mon séjour — Shelter&Co", "X-WR-TIMEZONE:Europe/Paris",
        *ICS_TZ_PARIS,
        "BEGIN:VEVENT",
        f"UID:{uid}@shelterandco.legacy-hospitality",
        "DTSTAMP:" + datetime.utcnow().strftime("%Y%m%dT%H%M%SZ"),
        f"DTSTART;TZID=Europe/Paris:{fmt(start)}",
        f"DTEND;TZID=Europe/Paris:{fmt(end)}",
        "SUMMARY:" + ics_text(one("title") or "Séjour — Shelter&Co", 120),
        "LOCATION:" + ics_text(one("location"), 200),
        "DESCRIPTION:" + ics_text(one("description"), 800),
        "END:VEVENT", "END:VCALENDAR",
    ]
    return "\r\n".join(lines) + "\r\n"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    # --- pages statiques : on ne sert jamais les fichiers internes ---------
    def send_head(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        parts = [p for p in path.split("/") if p]
        hidden = any(p.startswith(".") for p in parts)
        internal = path.endswith(".py") or "sources" in parts
        if hidden or internal:
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        # pas de cache pendant le développement : les modifications s'affichent tout de suite
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # --- API de l'assistant -------------------------------------------------
    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/calendrier.ics":
            try:
                data = build_ics(parse_qs(url.query)).encode("utf-8")
            except ValueError as e:
                self.send_error(400, str(e))
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/calendar; charset=utf-8")
            # « inline » : iPhone et Mac proposent directement d'ajouter l'événement
            self.send_header("Content-Disposition", 'inline; filename="sejour-shelter-co.ics"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def do_POST(self):
        route = self.path.split("?", 1)[0]
        if route == "/api/welcome":
            self._welcome()
            return
        if route != "/api/chat":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ValueError("Requête trop volumineuse.")
            body = json.loads(self.rfile.read(length))
            messages = clean_history(body.get("messages"))
            ref = str(body.get("ref") or "")[:32]
        except (ValueError, json.JSONDecodeError) as e:
            self._json(400, {"error": str(e) or "Requête invalide."})
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Connection", "close")
        self.end_headers()

        if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
            self._event({"error": "L'assistant n'est pas encore configuré (clé API manquante)."})
            return

        try:
            with client.beta.messages.stream(
                model=MODEL,
                max_tokens=8000,
                system=system_prompt(ref),
                messages=messages,
                output_config={"effort": "low"},  # questions-réponses : réponses rapides
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            ) as stream:
                for text in stream.text_stream:
                    self._event({"text": text})
                final = stream.get_final_message()
            if final.stop_reason == "refusal":
                self._event({"error": "Je ne peux pas répondre à cette demande. "
                                      "La réception reste à votre disposition 24 h/24."})
            self._event({"done": True})
        except anthropic.AuthenticationError:
            self._event({"error": "L'assistant n'est pas configuré (clé API manquante ou invalide)."})
        except anthropic.RateLimitError:
            self._event({"error": "L'assistant est très sollicité. Réessayez dans un instant."})
        except anthropic.APIStatusError as e:
            print("Erreur API :", e.status_code, e.message, file=sys.stderr)
            self._event({"error": "L'assistant est momentanément indisponible."})
        except anthropic.APIConnectionError:
            self._event({"error": "Connexion à l'assistant impossible. Vérifiez votre connexion."})
        except (BrokenPipeError, ConnectionResetError):
            pass  # le client a fermé la page

    # --- Formulaire Welcome -------------------------------------------------
    def _welcome(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 20_000:
                raise ValueError("Requête invalide.")
            demande = clean_welcome(json.loads(self.rfile.read(length)))
        except (ValueError, json.JSONDecodeError) as e:
            self._json(400, {"error": str(e) or "Requête invalide."})
            return

        if not rate_ok(self.client_address[0]):
            self._json(429, {"error": "Trop de demandes envoyées. Réessayez dans quelques minutes "
                                      "ou contactez la réception."})
            return

        demande["id"] = "W-" + datetime.now().strftime("%Y%m%d") + "-" + secrets.token_hex(3).upper()
        demande["recue_le"] = datetime.now().isoformat(timespec="seconds")
        DEMANDES.mkdir(exist_ok=True)
        (DEMANDES / f"{demande['id']}.json").write_text(
            json.dumps(demande, ensure_ascii=False, indent=2), encoding="utf-8")

        emailed = False
        if smtp_configured():
            try:
                send_welcome_email(demande)
                emailed = True
            except (smtplib.SMTPException, OSError) as e:
                print("Envoi de l'e-mail impossible :", e, file=sys.stderr)
                self._json(502, {"error": "Votre demande n'a pas pu être transmise. "
                                          "Merci de contacter directement la réception."})
                return
        else:
            print(f"Demande {demande['id']} enregistrée (e-mail non configuré).", file=sys.stderr)

        self._json(200, {"ok": True, "id": demande["id"], "emailed": emailed})

    def _event(self, payload):
        self.wfile.write(f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8"))
        self.wfile.flush()

    def _json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    if not smtp_configured():
        print("⚠  E-mail de la réception non configuré : les demandes Welcome "
              "sont enregistrées dans .demandes/ sans être envoyées.", file=sys.stderr)
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("⚠  ANTHROPIC_API_KEY n'est pas définie : le site fonctionne, "
              "mais l'assistant répondra qu'il n'est pas configuré.", file=sys.stderr)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Site disponible sur http://localhost:{PORT}")
    server.serve_forever()
