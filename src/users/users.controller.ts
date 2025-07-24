import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { SaveUserDto } from './dto/save-user.dto';

@Controller('users')
export class UsersController {
    constructor(
      private readonly usersService: UsersService,
    ) {}
    
    @Post('save')
    getOrCreateGuestUser(@Body() body: SaveUserDto) {
        return this.usersService.getOrCreateGuestUser(body.email)
    }
}
