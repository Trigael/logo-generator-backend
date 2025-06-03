import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Client } from 'node-mailjet';
import { LogoService } from 'src/logo/logo.service';
import { PaymentsService } from 'src/payments/payments.service';
import { UsersService } from 'src/users/users.service';
import { InternalErrorException } from 'src/utils/exceptios';

@Injectable()
export class MailService {
    private readonly mailjet;

    constructor(
        @Inject(forwardRef(() => PaymentsService))
        private readonly paymentsService: PaymentsService,
        @Inject(forwardRef(() => UsersService))
        private readonly usersService: UsersService,
        @Inject(forwardRef(() => LogoService))
        private readonly logoService: LogoService,
    ) {
      this.mailjet = Client.apiConnect(
        process.env.MAILJET_API_KEY ?? '', 
        process.env.MAILJET_API_SECRET ?? '' 
      );
    }
    
    async sendEmail(to: string, subject: string, templateId?: number, variables?: Record<string, string>) {
        try {
            const response = await this.mailjet
                .post('send', { version: 'v3.1' })
                .request({
                    Messages: [
                        {
                            From: {
                                Email: process.env.MAILJET_FROM_EMAIL,
                                Name: process.env.MAILJET_FROM_NAME || 'Gym Reservations',
                            },
                            To: [{ Email: to,
                              Name: 'Příjemce'
                             }],
                            Subject: subject,
                            TemplateID: templateId,
                            TemplateLanguage: true,
                            Variables: variables,
                        },
                    ],
                });

            return response.body;
        } catch (error) {
            console.log(`MailService Error: ${error}`)
        }
    }

    async sendLogoEmailAfterPayment(payment_id: number) {
        //
        const payment = await this.paymentsService.getPayment(payment_id)

        if(!payment) throw new InternalErrorException('Payment not found. Sending cofirmation email failed')

        const user = await this.usersService.getUser(payment?.user_id)
        const logo = await this.logoService.getLogoByPayment(payment.id_payment)
        
        if(!user) throw new InternalErrorException('User not found. Sending cofirmation email failed')
        
        return this.sendEmail(
            user.email,
            `[${payment.id_payment}] Potvrzení platby`,
            Number(process.env.MAILJET_TEMPLATE_ID),
            {
                logo_url: `${logo?.url}`,
            }
        )
    }
}
