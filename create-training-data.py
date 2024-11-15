import os
import pandas as pd
from fpdf import FPDF
from utils import pdf_directory

### import my data

practice_csv = pd.read_csv("Data/Training/practiceInfo.csv")
set_csv = pd.read_csv("Data/Training/setInfo.csv")
exercise_csv = pd.read_csv("Data/Training/exerciseInfo.csv")


###   pdfs -> csv -> pandas -> pdfs -> embedding -> vector index -> llama -> output

practice_data_list = []

# group data
for index, row in practice_csv.iterrows():
  practice = []

  practice.append("PRACTICETITLE")
  practice.append(row['title'])

  for index, row in set_csv.iterrows():
    if row['practiceID'] == row['practiceID']:
      practice.append("SETID")
      practice.append(row['setID'])

      practice.append("SETTITLE")
      practice.append(row['title'])

      practice.append("SETROUNDS")
      practice.append(row['rounds'])

      for index, row in exercise_csv.iterrows():
        if row['practiceID'] == row['practiceID'] and row['setID'] == row['setID']:
          practice.append("EXERCISEID")
          practice.append(row['exerciseID'])

          practice.append("EXERCISEREPS")
          practice.append(row['reps'])

          practice.append("EXERCISEDISTANCE")
          practice.append(row['distance'])

          practice.append("EXERCISEENERGY")
          practice.append(row['energy'])

          practice.append("EXERCISETYPE")
          practice.append(row['type'])

          practice.append("EXERCISESTROKE")
          practice.append(row['stroke'])

  practice_data_list.append(practice)

# print(practice_data_list)

# turn into pdf documents for vector embedding

# Ensure the directory exists; if not, create it
if not os.path.exists(pdf_directory):
    os.makedirs(pdf_directory)


# Function to create PDF for each practice
def create_pdf(document_text, file_path):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    # Add the text to the PDF
    pdf.multi_cell(0, 10, document_text)

    # Save the PDF to the specified file path
    pdf.output(file_path)

# Convert each practice (sub-list) into a document string and create PDFs
for idx, practice in enumerate(practice_data_list):
    # Join the elements of each sub-list into a single document string
    document_text = ' '.join(map(str, practice))

    # Define the PDF file path
    file_name = f"practice_{idx}.pdf"
    file_path = os.path.join(pdf_directory, file_name)

    # Create the PDF
    create_pdf(document_text, file_path)

print("PDF documents created successfully!")