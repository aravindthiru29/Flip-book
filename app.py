import os
import uuid
import fitz  # PyMuPDF
from flask import Flask, render_template, request, redirect, url_for, send_from_directory, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
# from pdf2image import convert_from_path
from pathlib import Path

app = Flask(__name__)

# Basic Config
BASE_DIR = Path(__file__).resolve().parent
app.config['SECRET_KEY'] = 'dev-key-flipbook-123'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///flipbook.db'
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads')
app.config['PAGES_FOLDER'] = os.path.join(BASE_DIR, 'static', 'pages')
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB limit

db = SQLAlchemy(app)

# Database Models
class Book(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    page_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    notes = db.relationship('Note', backref='book', lazy=True)
    highlights = db.relationship('Highlight', backref='book', lazy=True)

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.String(36), db.ForeignKey('book.id'), nullable=False)
    page_number = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

class Highlight(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.String(36), db.ForeignKey('book.id'), nullable=False)
    page_number = db.Column(db.Integer, nullable=False)
    rects = db.Column(db.Text, nullable=False)  # JSON string of rects: [{"x":0.1, "y":0.2, "w":0.05, "h":0.01}, ...]
    color = db.Column(db.String(20), default='rgba(255, 255, 0, 0.4)')

with app.app_context():
    db.create_all()

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PAGES_FOLDER'], exist_ok=True)

def extract_toc(pdf_path):
    """Extracts Table of Contents from PDF using PyMuPDF."""
    try:
        doc = fitz.open(pdf_path)
        toc = doc.get_toc()
        # [level, title, page] - we convert to list of dicts
        formatted_toc = []
        for item in toc:
            formatted_toc.append({
                'level': item[0],
                'title': item[1],
                'page': item[2]
            })
        return formatted_toc
    except Exception as e:
        print(f"TOC extraction error: {e}")
        return []

@app.route('/')
def index():
    return render_template('upload.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'pdf' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['pdf']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Only PDF files allowed'}), 400

    # Generate unique ID and save file
    book_id = str(uuid.uuid4())
    safe_name = secure_filename(file.filename)
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{book_id}_{safe_name}")
    file.save(save_path)

    # Create conversion directory
    pages_dir = os.path.join(app.config['PAGES_FOLDER'], book_id)
    os.makedirs(pages_dir, exist_ok=True)

    try:
        # Convert PDF to Images using PyMuPDF (much faster and no Poppler dependency)
        doc = fitz.open(save_path)
        page_count = len(doc)
        
        for i in range(page_count):
            page = doc.load_page(i)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # Scale up for better quality
            pix.save(os.path.join(pages_dir, f"page_{i+1}.jpg"))
        doc.close()

        # Save to DB
        new_book = Book(
            id=book_id,
            title=file.filename,
            filename=f"{book_id}_{safe_name}",
            page_count=page_count
        )
        db.session.add(new_book)
        db.session.commit()

        return jsonify({'id': book_id, 'redirect': url_for('view_flipbook', book_id=book_id)})
    
    except Exception as e:
        print(f"Error processing PDF: {e}")
        return jsonify({'error': f'Failed to process PDF: {str(e)}'}), 500

@app.route('/flipbook/<book_id>')
def view_flipbook(book_id):
    book = Book.query.get_or_404(book_id)
    pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], book.filename)
    toc = extract_toc(pdf_path)
    
    # List of page image URLs
    pages = [url_for('static', filename=f'pages/{book_id}/page_{i+1}.jpg') for i in range(book.page_count)]
    
    return render_template('flipbook.html', book=book, pages=pages, toc=toc)

@app.route('/download/<book_id>')
def download_pdf(book_id):
    book = Book.query.get_or_404(book_id)
    return send_from_directory(app.config['UPLOAD_FOLDER'], book.filename, as_attachment=True, download_name=book.title)

@app.route('/api/notes/<book_id>', methods=['GET'])
def get_notes(book_id):
    notes = Note.query.filter_by(book_id=book_id).all()
    return jsonify([{
        'id': n.id,
        'page': n.page_number,
        'content': n.content,
        'created_at': n.created_at.isoformat()
    } for n in notes])

@app.route('/api/notes/<book_id>', methods=['POST'])
def save_note(book_id):
    data = request.json
    note = Note(
        book_id=book_id,
        page_number=data['page'],
        content=data['content']
    )
    db.session.add(note)
    db.session.commit()
    return jsonify({'id': note.id})

@app.route('/api/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    note = Note.query.get_or_404(note_id)
    db.session.delete(note)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/highlights/<book_id>', methods=['GET'])
def get_highlights(book_id):
    highlights = Highlight.query.filter_by(book_id=book_id).all()
    import json
    return jsonify([{
        'id': h.id,
        'page': h.page_number,
        'rects': json.loads(h.rects),
        'color': h.color
    } for h in highlights])

@app.route('/api/highlights/<book_id>', methods=['POST'])
def save_highlights(book_id):
    data = request.json
    import json
    highlight = Highlight.query.filter_by(book_id=book_id, page_number=data['page']).first()
    if highlight:
        highlight.rects = json.dumps(data['rects'])
    else:
        highlight = Highlight(
            book_id=book_id,
            page_number=data['page'],
            rects=json.dumps(data['rects']),
            color=data.get('color', 'rgba(255, 255, 0, 0.4)')
        )
        db.session.add(highlight)
    db.session.commit()
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True)
