export interface Game {
    id: number; 
    title: string;
    genre: string | null;
    platform: string | null;
    release_date: string | null;
    rating: number | null;
    image: string | null;
    rawg_id: number | null;
    
}