import json
import os
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Embedding, LSTM, Dense
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences

# Function to read and parse a CSV file
def read_csv(file_path):
    return pd.read_csv(file_path).to_dict('records')

# Function to calculate vocab size and tokenize
def calculate_vocab_size_and_tokenize():
    practices = read_csv('Data/Training/practiceInfo.csv')
    sets = read_csv('Data/Training/setInfo.csv')
    all_text_data = [practice['title'] for practice in practices] + [set['title'] for set in sets]
    tokenizer = Tokenizer()
    tokenizer.fit_on_texts(all_text_data)
    vocab_size = len(tokenizer.word_index) + 1
    return vocab_size, tokenizer.word_index

# Function to preprocess hierarchical data
def preprocess_data(vocab_size, unique_tokens):
    practices = read_csv('Data/Training/practiceInfo.csv')
    sets = read_csv('Data/Training/setInfo.csv')
    practice_sets = [{**practice, 'sets': [set for set in sets if set['practiceID'] == practice['practiceID']]} for practice in practices]
    practice_exercise_sequences = [{
        'practiceTitle': practice['title'],
        'setTitles': '|'.join([set['title'] for set in practice['sets']])
    } for practice in practice_sets]
    encoded_practice_titles = [[unique_tokens[token] + 1 for token in practice['practiceTitle'].split()] for practice in practice_exercise_sequences]
    encoded_set_titles = [[unique_tokens[token] + 1 for token in practice['setTitles'].split()] for practice in practice_exercise_sequences]
    max_practice_title_length = max(len(title) for title in encoded_practice_titles)
    max_set_title_length = max(len(title) for title in encoded_set_titles)
    practice_titles = pad_sequences(encoded_practice_titles, maxlen=max_practice_title_length, padding='post')
    set_titles = pad_sequences(encoded_set_titles, maxlen=max_set_title_length, padding='post')
    return practice_titles, max_practice_title_length, set_titles, max_set_title_length

# Function to create and train the model
def create_set_model():
    vocab_size, unique_tokens = calculate_vocab_size_and_tokenize()
    X, max_x_length, Y, max_y_length = preprocess_data(vocab_size, unique_tokens)
    with open(os.path.join('Models/V3-RealData', 'maxXLength.json'), 'w') as f:
        json.dump({'maxXLength': max_x_length}, f)
    model = Sequential()
    embedding_dim = 128
    lstm_units = 128
    model.add(Embedding(input_dim=vocab_size, output_dim=embedding_dim, input_length=max_x_length))
    model.add(LSTM(lstm_units, return_sequences=True))
    model.add(LSTM(lstm_units))
    model.add(Dense(max_y_length, activation='softmax'))
    model.compile(optimizer='adam', loss='categorical_crossentropy')
    model.fit(X, Y, epochs=500, batch_size=4)
    model.save('Models/V3-RealData')

# Call the function to start the execution
if __name__ == "__main__":
    create_set_model()