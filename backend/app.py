import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import MySQLdb
from werkzeug.security import generate_password_hash, check_password_hash

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
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        passwd=os.getenv("DB_PASSWORD"),
        db=os.getenv("DB_NAME")
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
    try:
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

        # HASH PASSWORD
        hashed_password = generate_password_hash(password)

        # insert user
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (%s,%s,%s)",
            (name, email, hashed_password)
        )

        db.commit()

        cursor.close()
        db.close()

        return jsonify({"status": "success"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


# -------------------------
# LOGIN API
# -------------------------
@app.route("/api/login", methods=["POST"])
def login():
    try:
        data = request.json

        email = data.get("email")
        password = data.get("password")

        db = get_db()
        cursor = db.cursor()

        cursor.execute("SELECT password FROM users WHERE email=%s", (email,))
        user = cursor.fetchone()

        cursor.close()
        db.close()

        if user and check_password_hash(user[0], password):
            return jsonify({"status": "success"})
        else:
            return jsonify({"status": "fail"})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


# -------------------------
# RUN SERVER (LOCAL ONLY)
# -------------------------
if __name__ == "__main__":
    app.run(debug=True)