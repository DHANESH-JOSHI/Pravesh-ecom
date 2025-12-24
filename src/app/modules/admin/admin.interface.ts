import { IUser } from "../user/user.interface";

export interface IAdmin extends IUser {
  role: "admin" | "staff";
}

