// This is a very basic example and might not cover all your needs, but it
// should give you a starting point. For a real application, you would need
// to consider error handling, security, and possibly a more complex routing setup.

const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const port = 3000;

console.log('Starting server...');

// Middleware
app.use(cors({
    origin: "*", //['http://localhost:5500'], // Allow requests from your local development webserver
    methods: "POST",
    credentials: false,
    maxAge: 3600
}));
console.log('Cors middleware applied');

app.use((req, res, next) => {
    console.log('Incoming request:', req.method, req.url);
    next();
});

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));
console.log('Static files being served from public folder');

// API endpoint to generate practice sessions
app.use('/generate-practice', express.json(), async (req, res) => {
    console.log('Received request to generate practice');
    console.log('Method:', req.method);
    try {        
        const directory = './'; // Specify the directory containing your data
        const prompt = req.body.question || '';
        console.log(`Processing prompt: "${prompt}"`);

        // Spawn a new Python process
        const pythonProcess = spawn('python', ['run_model.py', prompt]);
        console.log('Python process spawned');

        let result = '';

        // Handle stdout
        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
            console.log('Received data from Python process:', data.toString());
        });

        // Handle stderr
        pythonProcess.stderr.on('data', (data) => {
            console.error('Error from Python process:', data.toString());
        });

        // Handle exit
        pythonProcess.on('close', (code) => {
            console.log(`Python process exited with code ${code}`);
            
            // Format the output
            const formattedResult = result.replace(/\*\*+/g, '<strong>').replace(/__/g, '</strong>');
            console.log('Formatted result:', formattedResult);
            
            // Send response back to client
            res.json({ 
                success: true,
                practice: formattedResult
            });
            console.log('Sending response back to client');
        });
    } catch (error) {
        console.error('Error generating practice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate practice session'
        });
        console.log('Sent error response to client');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
