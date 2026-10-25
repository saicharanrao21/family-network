import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { CurrentUserId } from '../common/auth-user.decorator';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private service: SearchService) {}

  @Get('people') people(@CurrentUserId() userId: string, @Query('q') q = '', @Query('limit') limit?: string) {
    return this.service.people(userId, q, Number(limit || 50));
  }

  @Get('surname-suggestions') surnameSuggestions(@CurrentUserId() userId: string, @Query('personId') personId: string, @Query('limit') limit?: string) {
    return this.service.surnameSuggestions(userId, personId, Number(limit || 30));
  }

  @Get('relationship-targets') relationshipTargets(@CurrentUserId() userId: string, @Query('q') q = '') {
    return this.service.relationshipSearch(userId, q);
  }
}
