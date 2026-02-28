import { drizzle } from 'drizzle-orm/mysql2';
import { courses } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Ocultar Test Course
await db.update(courses).set({ isPublished: 0 }).where(eq(courses.id, 1));
console.log('✅ Test Course ocultado');

// Corrigir MENTE RICA
await db.update(courses).set({ 
  title: 'Mente Rica',
  description: 'Este curso tem como objetivo destravar sua vida financeira e construir uma mentalidade próspera.'
}).where(eq(courses.id, 60001));
console.log('✅ MENTE RICA corrigido');

process.exit(0);
