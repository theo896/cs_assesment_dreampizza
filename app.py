"""Dream Pizzas - phone order terminal (Flask back end).

The browser page (templates/index.html + static/js/script.js) only draws the
screens and reacts to clicks. All of the business rules live here: the menu,
prices, input validation, order totals and the list of completed orders.
"""

import re

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)


# ── Constants (no magic numbers in the rest of the code) ─────────────────────

REGULAR_PRICE = 8.50
GOURMET_SURCHARGE = 5.00
DELIVERY_CHARGE = 3.00
MAX_PIZZAS = 5
REGULAR_PIZZA_COUNT = 7        # first 7 menu items are regular, the rest gourmet
MIN_NAME_LENGTH = 2
MIN_PHONE_DIGITS = 7
MAX_PHONE_DIGITS = 11

# Digits plus the separators people normally type in a phone number.
PHONE_ALLOWED_CHARS = re.compile(r"^[0-9 +\-()]+$")

# ── Data ─────────────────────────────────────────────────────────────────────

PIZZA_NAMES = [
    "Margherita Classic", "Pepperoni Feast", "Hawaiian Breeze",
    "Garden Vegetarian", "Meat Lovers", "BBQ Chicken", "Four Cheese",
    "Smoked Salmon & Dill", "Truffle Mushroom", "Prosciutto & Rocket",
    "Mediterranean Lamb", "Spicy Nduja Diavola",
]

# Orders finished this session (a list of dictionaries). It lives in memory,
# so it is cleared when the server restarts.
completed_orders = []


def price_for_index(index):
    """Return the price of the menu item at `index` (regular or gourmet)."""
    if index < REGULAR_PIZZA_COUNT:
        return REGULAR_PRICE
    return REGULAR_PRICE + GOURMET_SURCHARGE


def build_menu():
    """Build the menu as a list of dictionaries with name, category and price."""
    menu = []
    for index, name in enumerate(PIZZA_NAMES):
        category = "regular" if index < REGULAR_PIZZA_COUNT else "gourmet"
        menu.append({
            "index": index,
            "name": name,
            "category": category,
            "price": price_for_index(index),
        })
    return menu


MENU = build_menu()


# ── Validation ───────────────────────────────────────────────────────────────

def is_valid_name(name):
    """A name is valid if it has at least MIN_NAME_LENGTH characters."""
    return len(str(name).strip()) >= MIN_NAME_LENGTH


def is_valid_address(address):
    """An address is valid if it is not empty."""
    return len(str(address).strip()) > 0


def is_valid_phone(phone):
    """Accept only digits and common separators, then check the digit count.

    Rejecting other characters first stops text like "call021abc4567" from
    passing because its letters were stripped before the digits were counted.
    """
    text = str(phone).strip()
    if not PHONE_ALLOWED_CHARS.match(text):
        return False
    digit_count = len(re.sub(r"\D", "", text))
    return MIN_PHONE_DIGITS <= digit_count <= MAX_PHONE_DIGITS


def validate_details(is_delivery, name, address, phone):
    """Return a dictionary of field -> error message for any invalid field."""
    errors = {}
    if not is_valid_name(name):
        errors["name"] = "Please enter the customer's name."
    if is_delivery:
        if not is_valid_address(address):
            errors["address"] = "Please enter a delivery address."
        if not is_valid_phone(phone):
            errors["phone"] = "Please enter a valid phone number."
    return errors


def validate_pizza_indices(indices, min_count=1):
    """Return True if `indices` is a list of real menu indices.

    The list must hold between `min_count` and MAX_PIZZAS items.
    """
    if not isinstance(indices, list) or not min_count <= len(indices) <= MAX_PIZZAS:
        return False
    return all(isinstance(i, int) and 0 <= i < len(MENU) for i in indices)


# ── Totals ───────────────────────────────────────────────────────────────────

def calculate_subtotal(indices):
    """Add up the price of every chosen pizza."""
    return sum(MENU[i]["price"] for i in indices)


def calculate_summary(indices, is_delivery):
    """Return the itemised order with subtotal, delivery charge and total."""
    subtotal = calculate_subtotal(indices)
    delivery_charge = DELIVERY_CHARGE if is_delivery else 0.0
    return {
        "items": [MENU[i] for i in indices],
        "subtotal": subtotal,
        "delivery_charge": delivery_charge,
        "total": subtotal + delivery_charge,
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    """Serve the single page that runs the order terminal."""
    return render_template("index.html")


@app.route("/api/config")
def get_config():
    """Send the menu and the limits the page needs to draw its screens."""
    return jsonify({
        "menu": MENU,
        "max_pizzas": MAX_PIZZAS,
        "delivery_charge": DELIVERY_CHARGE,
    })


@app.route("/api/validate-details", methods=["POST"])
def check_details():
    """Check the customer details step and report which fields are wrong."""
    data = request.get_json(silent=True) or {}
    errors = validate_details(
        bool(data.get("is_delivery")),
        data.get("name", ""),
        data.get("address", ""),
        data.get("phone", ""),
    )
    return jsonify({"valid": not errors, "errors": errors})


@app.route("/api/summary", methods=["POST"])
def get_summary():
    """Work out the totals for the pizzas picked so far (may be empty)."""
    data = request.get_json(silent=True) or {}
    indices = data.get("pizza_indices", [])
    if not validate_pizza_indices(indices, min_count=0):
        return jsonify({"error": "Invalid pizza selection."}), 400
    return jsonify(calculate_summary(indices, bool(data.get("is_delivery"))))


@app.route("/api/orders", methods=["GET"])
def list_orders():
    """Return every order completed this session."""
    return jsonify(completed_orders)


@app.route("/api/orders", methods=["POST"])
def save_order():
    """Re-check a finished order, store it and return it with its total."""
    data = request.get_json(silent=True) or {}
    is_delivery = bool(data.get("is_delivery"))
    indices = data.get("pizza_indices", [])

    errors = validate_details(is_delivery, data.get("name", ""),
                              data.get("address", ""), data.get("phone", ""))
    if errors or not validate_pizza_indices(indices):
        return jsonify({"error": "Order is not valid.", "errors": errors}), 400

    summary = calculate_summary(indices, is_delivery)
    order = {
        "name": str(data["name"]).strip(),
        "is_delivery": is_delivery,
        "address": str(data.get("address", "")).strip() if is_delivery else "",
        "phone": str(data.get("phone", "")).strip() if is_delivery else "",
        "pizzas": summary["items"],
        "subtotal": summary["subtotal"],
        "delivery_charge": summary["delivery_charge"],
        "total": summary["total"],
    }
    completed_orders.append(order)
    return jsonify(order), 201


if __name__ == "__main__":
    app.run(debug=True)
