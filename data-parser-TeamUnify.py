import os
import re
import PyPDF2
import pandas as pd

def clean_number(number):
    return int(re.sub(r'[^\d]', '', str(number)))

def convert_to_seconds(time):
    if ':' in time:
        minutes, seconds = map(int, time.split(':'))
        return minutes * 60 + seconds
    elif 'h' in time:
        hours, minutes = map(int, time.split('h'))
        return hours * 3600 + minutes * 60
    else:
        return int(time)

def parse_pdf(pdf_file):
    """
    Parse a PDF file and return its content as text.
    """
    pdf_reader = PyPDF2.PdfReader(pdf_file)
    text = ''
    for page_num in range(len(pdf_reader.pages)):
        text += pdf_reader.pages[page_num].extract_text()
    return text

def data_parser():
    """
    Main function to parse TeamUnify data from PDF files.
    """
    directory_path = os.path.join(os.getcwd(), 'Data', 'Raw', 'TeamUnify')
    
    lined_data_array = []
    set_grouped_data_array = []
    current_group = []
    filtered_data_array = []
    practice_grouped_data_array = []

    # Scan PDFs
    def scan_pdfs():
        """
        Read all PDF files in the specified directory and extract their contents.
        """
        for file in os.listdir(directory_path):
            if file.endswith('.pdf'):
                data_buffer = open(os.path.join(directory_path, file), 'rb')
                try:
                    data = parse_pdf(data_buffer)
                    lines = data.split('\n')
                    lined_data_array.extend(lines)
                except Exception as error:
                    print(f"Error parsing PDF file {file}: {error}")
                finally:
                    data_buffer.close()

    scan_pdfs()

    # Group into sets
    for i, line in enumerate(lined_data_array):
        if isinstance(line, str) and isinstance(lined_data_array[i - 1], str):
            if line.endswith(' x') and re.match(r'^\d+ x ', lined_data_array[i - 1]):
                current_group.append(lined_data_array[i - 1])
                set_grouped_data_array.append(current_group)
                current_group = []
            elif line == '' or line.endswith(' x'):
                if current_group:
                    set_grouped_data_array.append(current_group)
                    current_group = []
                if i > 0:
                    current_group.append(lined_data_array[i - 1])
            else:
                current_group.append(lined_data_array[i - 1])

    if current_group:
        set_grouped_data_array.append(current_group)

    # Filter necessary info
    filtered_data_array = [
        item for sublist in set_grouped_data_array 
        for item in sublist if isinstance(item, str) and not item.startswith("This website is powered")
    ]

    # Group into practices
    practice_grouped_data_array = []
    current_group = []
    for line in filtered_data_array:
        if isinstance(line[0], str) and isinstance(line[1], str):
            if line[0] == '' and line[1] == '':
                if current_group:
                    practice_grouped_data_array.append(current_group)
                    current_group = []
            current_group.append(line)
    if current_group:
        practice_grouped_data_array.append(current_group)

    # Create practiceInfo, setInfo, and exerciseInfo
    practice_info = []
    set_info = []
    exercise_info = []

    for practice_id, practice in enumerate(practice_grouped_data_array):
        practice_info.append(practice[0])
        practice_info = [
            info for info in practice_info 
            if info != '' and len(info) > 0
        ]
        for i in range(len(practice)):
            if i == 0:
                continue
            set_id = i - 1
            temp_array = [
                practice_id,     # practice id
                set_id,          # set id
                practice[i],      # title
                practice[i+1],    # distance
                practice[i+2],    # duration
                practice[i+3],    # rounds
            ]
            set_info.append(temp_array)
            exercise_info.append(temp_array)

    # Parse set info
    for set in set_info:
        practice_id, set_id, title, distance, duration, rounds = set
        set_headers = next((item for item in set if isinstance(item, str) and item.endswith(' x')), None)
        if set_headers == set[2] or re.match(r'^\d+ x ', set[2]):
            title = "Untitled"
        else:
            title = set[2]

        dissection = (
            set_headers.split(',')[:4] + [set_headers.split(',')[4].strip()] +
            set_headers.split(',')[4:].split()
        )
        distance = clean_number(dissection[0])
        duration = convert_to_seconds(dissection[1].split(':')[1][:3])
        rounds = dissection[1].split(':')[-1].split()[0]
        set_info[set_info.index(set)] = [
            practice_id, set_id, title, distance, duration, rounds
        ]

    # Parse exercise info
    for set in exercise_info:
        practice_id, set_id, _, distance, interval, energy, type, stroke, pace, notes = set
        set_headers = next((item for item in set if isinstance(item, str) and item.endswith(' x')), None)
        exercise_index = list(set).index(set_headers) + 1

        for i in range(exercise_index, len(set)):
            exercise = set[i]
            if re.match(r'^\d+ x ', exercise):
                reps = exercise.split(' x ')[0].strip()
                distance = clean_number(exercise.split(' x ')[1].split('@')[0].strip())
                interval = exercise.split('@')[1].strip()
                interval = convert_to_seconds(interval[:5])
                stats_index = -1
                stats = ''
                try:
                    if 'EN' in exercise:
                        stats_index = exercise.index('EN')
                    elif 'RE' in exercise:
                        stats_index = exercise.index('RE')
                    elif 'SP' in exercise:
                        stats_index = exercise.index('SP')
                    stats = exercise[stats_index:]
                except Exception as error:
                    print(f"Error parsing stats for exercise {exercise}")
                
                energy = stats[:3].strip()
                type = stats[3:4].strip() if stats[3] else 'N'
                stroke = (
                    stats[5:8].strip() if len(stats[5:]) == 7 
                    else stats[5:7].strip() if len(stats[5:]) == 6 
                    else stats[4:7].strip() if len(stats[4:]) == 6 
                    else stats[4:6].strip()
                )
                try:
                    pace = stats[-5:].strip()
                except Exception as error:
                    print(f"Error parsing pace for exercise {exercise}")
                
                try:
                    notes_index = exercise.index(':') + 3
                    notes = exercise[notes_index:stats_index].strip()
                except Exception as error:
                    print(f"Error parsing notes for exercise {exercise}")

                exercise_info[set_info.index(set)] = [
                    practice_id, set_id, i, reps, distance, interval, energy, type, stroke, pace, notes
                ]

    # Flatten exerciseInfo
    exercise_info = [item for sublist in exercise_info for item in sublist]

    # Convert to objects
    practice_info = [{
        "practiceID": info[0],
        "title": info[1],
    } for info in practice_info]

    set_info = [{
        "practiceID": info[0],
        "setID": info[1],
        "title": info[2],
        "rounds": info[5]
    } for info in set_info]

    exercise_info = [{
        "practiceID": info[0],
        "setID": info[1],
        "exerciseID": info[2],
        "reps": info[3],
        "distance": info[4],
        "interval": info[5],
        "energy": info[6],
        "type": info[7],
        "stroke": info[8],
        "pace": info[9],
        "notes": info[10]
    } for info in exercise_info]

    # Write to CSV files
    df_practice_info = pd.DataFrame(practice_info)
    df_set_info = pd.DataFrame(set_info)
    df_exercise_info = pd.DataFrame(exercise_info)

    df_practice_info.to_csv('Data/Training/practiceInfo.csv', index=False)
    df_set_info.to_csv('Data/Training/setInfo.csv', index=False)
    df_exercise_info.to_csv('Data/Training/exerciseInfo.csv', index=False)

if __name__ == "__main__":
    data_parser()