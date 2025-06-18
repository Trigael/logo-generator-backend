import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Client } from 'node-mailjet';
import { LogoService } from 'src/logo/logo.service';
import { PaymentsService } from 'src/payments/payments.service';
import { UsersService } from 'src/users/users.service';
import { InternalErrorException } from 'src/utils/exceptios';
import { getSecret } from 'src/utils/helpers.util';

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
        getSecret(process.env.MAILJET_API_KEY ?? ''), 
        getSecret(process.env.MAILJET_API_SECRET ?? '' )
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
                                Email: getSecret(process.env.MAILJET_FROM_EMAIL ?? ''),
                                Name: getSecret(process.env.MAILJET_FROM_NAME ?? '') ?? 'AI Logo Creator',
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
            if (error.response) console.error('Mailjet error response:', error.response.body);

            console.error(`[MailService] Error: ${error}`);
        }
    }

    async sendLogoEmailAfterPayment(payment_id: number) {
        // TODO: Save in Mails DB Table
        const payment = await this.paymentsService.getPayment(payment_id)

        if(!payment) throw new InternalErrorException('Payment not found. Sending cofirmation email failed')

        const user = await this.usersService.getUser(payment?.user_id)
        
        if(!user) throw new InternalErrorException('User not found. Sending cofirmation email failed')
        
        return this.sendEmail(
            user.email,
            `[${payment.id_payment}] Potvrzení platby`,
            Number(getSecret(process.env.MAILJET_TEMPLATE_ID ?? '')),
            {
                logo_url: `PLACEHOLDER_URL/LOGO`,
            }
        )
    }
}
