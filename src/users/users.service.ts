import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class UsersService {
    constructor(
        private readonly db: DatabaseService,
    ) {}

    async getUser(user_id: number) {
        return await this.db.users.findUnique({ where: {id_user: user_id}})
    }
}
