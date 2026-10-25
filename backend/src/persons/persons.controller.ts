import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUserId } from '../common/auth-user.decorator';
import { PersonsService } from './persons.service';

@Controller('persons')
@UseGuards(AuthGuard)
export class PersonsController {
  constructor(private service: PersonsService) {}

  @Post('self')
  self(@CurrentUserId() userId: string, @Body() body: { name: string }) {
    return this.service.createSelf(userId, body.name);
  }

  @Post(':id/names')
  name(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() body: { fullName: string; nameType?: string },
  ) {
    return this.service.addName(
      userId,
      id,
      body.fullName,
      body.nameType || 'ALTERNATE_SPELLING',
    );
  }

  @Post(':id/claim')
  claim(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.service.claim(userId, id);
  }
}
