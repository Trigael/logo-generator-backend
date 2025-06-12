import { ApiProperty } from '@nestjs/swagger';

class StripeDetailsDto {
  @ApiProperty({ example: true, description: 'Whether payment was successful' })
  success: boolean;

  @ApiProperty({
    example: 'https://checkout.stripe.com/c/pay/cs_test_a1O55VREZ8O2GDcla0Fck0bWnCnltHRSjXtEnI6QotvJ57dYqpMvbx84iG#fidkdWxOYHwnPyd1blpxYHZx...',
    description: 'Stripe payment URL',
  })
  payment_url: string;

  @ApiProperty({
    example: 'cs_test_a1O55VREZ8O2GDcla0Fck0bWnCnltHRSjXtEnI6QotvJ57dYqpMvbx84iG',
    description: 'Stripe session/payment ID',
  })
  stripe_id: string;
}

export class BuyLogoResponseDto {
  @ApiProperty({ example: 2, description: 'Payment ID' })
  id_payment: number;

  @ApiProperty({ example: 4, description: 'Order ID' })
  order_id: number;

  @ApiProperty({ example: 1, description: 'User ID' })
  user_id: number;

  @ApiProperty({
    example: 'cs_test_a1O55VREZ8O2GDcla0Fck0bWnCnltHRSjXtEnI6QotvJ57dYqpMvbx84iG',
    description: 'Stripe session/payment ID',
  })
  stripe_id: string;

  @ApiProperty({ example: 'CREATED', description: 'Payment state' })
  state: string;

  @ApiProperty({
    example: '2025-06-10T15:32:15.372Z',
    description: 'Created timestamp (ISO 8601)',
  })
  created_at: string;

  @ApiProperty({
    example: '2025-06-10T15:32:15.813Z',
    description: 'Updated timestamp (ISO 8601)',
  })
  updated_at: string;

  @ApiProperty({
    example: null,
    description: 'Deleted timestamp (nullable, ISO 8601)',
    nullable: true,
  })
  deteled_at: string | null;

  @ApiProperty({ example: false, description: 'Soft delete flag' })
  deleted: boolean;

  @ApiProperty({
    example: null,
    description: 'Optional metadata (nullable)',
    nullable: true,
  })
  metadata: any;

  @ApiProperty({ type: StripeDetailsDto, description: 'Stripe payment details' })
  stripe: StripeDetailsDto;
}
