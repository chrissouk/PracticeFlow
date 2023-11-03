// This is a very basic example and might not cover all your needs, but it
// should give you a starting point. For a real application, you would need
// to consider error handling, security, and possibly a more complex routing setup.

const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;
const generatePractice = require('./generate-practice');

const origins = [
    "http://127.0.0.1:5500",
];
app.use(cors({
    origin: origins,
    methods: ['GET', 'POST'],
    credentials: false,
    maxAge: 3600
  }));

app.get('/generate-practice', async (request, response) => {
    const practice = await generatePractice();
    response.send(practice);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});