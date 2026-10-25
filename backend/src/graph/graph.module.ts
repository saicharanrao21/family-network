import { Module } from '@nestjs/common';
import { GraphController } from './graph.controller';
import { RelationshipsModule } from '../relationships/relationships.module';

@Module({
  imports: [RelationshipsModule],
  controllers: [GraphController],
})
export class GraphModule {}
