import express from 'express';
import cors from 'cors';
import { booksRouter } from './routes/books.js';
import { charactersRouter } from './routes/characters.js';
import { chaptersRouter } from './routes/chapters.js';
import { ideasRouter } from './routes/ideas.js';
import { connectionsRouter } from './routes/connections.js';
import { illustrationsRouter } from './routes/illustrations.js';
import { timelineRouter } from './routes/timeline.js';
import { wishlistRouter } from './routes/wishlist.js';
import { imagesRouter } from './routes/images.js';
import { backupRouter } from './routes/backup.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/books', booksRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/chapters', chaptersRouter);
app.use('/api/ideas', ideasRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/illustrations', illustrationsRouter);
app.use('/api/timeline', timelineRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/images', imagesRouter);
app.use('/api/backup', backupRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lofi Books API running on port ${PORT}`);
});
