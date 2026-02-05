import os
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
raw_db_url = os.getenv("DATABASE_URL")
if raw_db_url:
    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_DATABASE_URI"] = raw_db_url
else:
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///contacts.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

class PDFFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

with app.app_context():
    db.create_all()

@app.route("/", methods=["GET", "POST"])
def upload_pdf():
    if request.method == "POST":
        file = request.files.get("pdf")
        if not file or file.filename == "":
            return "No file selected", 400

        filename = secure_filename(file.filename)
        file.save(os.path.join(UPLOAD_FOLDER, filename))

        db.session.add(PDFFile(filename=filename))
        db.session.commit()

        return redirect(url_for("view_pdf", filename=filename))

    return render_template("upload.html")

@app.route("/view/<filename>")
def view_pdf(filename):
    return render_template("view_pdf.html", filename=filename)

@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == "__main__":
    app.run(debug=True)