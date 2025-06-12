import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, Res } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { ApiParam } from '@nestjs/swagger';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}
    @Post('stripe')
    webhookForStripe(@Body() body, @Req() req) {
        return this.paymentsService.webhookForStripe(body, req)
    }
    
    @Get('verify/:id')
    @ApiParam({ name: "payment_id", required: true, type: Number, description: "Id of payments that you want to verify"})
    verifyPayment(@Param('id') id: VerifyPaymentDto['session_id']) {
        return this.paymentsService.verifyPayment({session_id: id})
    }
}
