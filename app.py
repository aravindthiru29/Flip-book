import os
from flask import Flask, render_template, request, redirect, url_for, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/", methods=["GET", "POST"])
def upload_pdf():
    if request.method == "POST":
        file = request.files.get("pdf")

        if not file or file.filename == "":
            return "No file selected", 400

        filename = secure_filename(file.filename)
        file.save(os.path.join(UPLOAD_FOLDER, filename))

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
