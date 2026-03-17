import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import MySQLdb

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static")
)

CORS(app)


# -------------------------
# DATABASE CONNECTION
# -------------------------
def get_db():
    return MySQLdb.connect(
        host="localhost",
        user="root",
        passwd="AshishGoyal",
        db="finclarity"
    )


# -------------------------
# HOME PAGE
# -------------------------
@app.route("/")
def home():
    return render_template("index.html")


# -------------------------
# LOGIN PAGE
# -------------------------
@app.route("/login")
def login_page():
    return render_template("login.html")


# -------------------------
# SIGNUP API
# -------------------------
@app.route("/api/signup", methods=["POST"])
def signup():

    data = request.json

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    db = get_db()
    cursor = db.cursor()

    # check existing user
    cursor.execute("SELECT * FROM users WHERE email=%s", (email,))
    user = cursor.fetchone()

    if user:
        cursor.close()
        db.close()
        return jsonify({"status": "exists"})

    # insert user
    cursor.execute(
        "INSERT INTO users (name, email, password) VALUES (%s,%s,%s)",
        (name, email, password)
    )

    db.commit()

    cursor.close()
    db.close()

    return jsonify({"status": "success"})


# -------------------------
# LOGIN API
# -------------------------
@app.route("/api/login", methods=["POST"])
def login():

    data = request.json

    email = data.get("email")
    password = data.get("password")

    db = get_db()
    cursor = db.cursor()

    cursor.execute(
        "SELECT * FROM users WHERE email=%s AND password=%s",
        (email, password)
    )

    user = cursor.fetchone()

    cursor.close()
    db.close()

    if user:
        return jsonify({"status": "success"})
    else:
        return jsonify({"status": "fail"})


# -------------------------
# RUN SERVER
# -------------------------
if __name__ == "__main__":
    app.run(debug=True)