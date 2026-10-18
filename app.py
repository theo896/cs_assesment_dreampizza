from flask import Flask, render_template

app = Flask(__name__)


# ── Routes ─────────────────────────────────────────────────────────────────────

# The pizza order terminal is a single-page app: all order logic
# (order type, customer details, pizza selection, totals, cancel)
# runs client-side in static/js/script.js. This route just serves
# the page that loads it.
@app.route('/')
def home():
    return render_template('index.html')


if __name__ == '__main__':
    app.run(debug=True)

