import { Request } from 'express';

export interface IMenuBookmark {
  menuItemId: string;
  hotelId: string;
  hotelName: string;
  menuTitle: string;
  menuImage: string;
  menuPrice: number;
  bookmarkedAt: Date;
}




export interface userInterface extends Request {
  user?: any; // Make this optional since it might not exist before auth
  // Remove menuBookmarks from here - it should be on the user object, not request
}
