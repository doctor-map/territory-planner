import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import router from './routes/api.ts';
import cors from 'cors';

const app = express();
const PORT = 3000;

// Parsing incoming requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors());

// API routes
app.use('/api', router);

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    return res.status(500).json(err);
})

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}...`);
})