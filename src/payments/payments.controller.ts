import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, Res } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}
    @Post('stripe')
    webhookForStripe(@Body() body, @Req() req) {
        return this.paymentsService.webhookForStripe(body, req)
    }
    
    @Get('verify/:id')
    verifyPayment(@Param('id', ParseIntPipe) id: VerifyPaymentDto['session_id']) {
        return this.paymentsService.verifyPayment({session_id: id})
    }
}
