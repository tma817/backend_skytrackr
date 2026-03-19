import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend = new Resend(process.env.RESEND_API_KEY);
  private readonly logger = new Logger(MailService.name);
  private readonly from = process.env.MAIL_FROM ?? 'SkyTrackr <onboarding@resend.dev>';

  async sendBookingConfirmation(booking: {
    bookingId: string;
    amadeusOrderId: string;
    pnr?: string;
    status: string;
    totalPrice: string;
    currency: string;
    travelers: any[];
    flightOffers: any[];
    seatings?: { segmentId: string; travelerId: string; seatNumber: string }[];
  }) {
    const recipients = booking.travelers
      .map((t) => t.contact?.emailAddress)
      .filter(Boolean) as string[];

    if (!recipients.length) {
      this.logger.warn(`No email recipients for booking ${booking.bookingId}`);
      return;
    }

    const html = this.buildBookingEmail(booking);

    try {
      await this.resend.emails.send({
        from: this.from,
        to: recipients,
        subject: `Booking Confirmed – PNR: ${booking.pnr || booking.amadeusOrderId}`,
        html,
      });
      this.logger.log(`Booking confirmation sent to ${recipients.join(', ')}`);
    } catch (error: any) {
      this.logger.error('Failed to send booking confirmation email', error.message);
    }
  }

  private buildBookingEmail(booking: {
    bookingId: string;
    amadeusOrderId: string;
    pnr?: string;
    status: string;
    totalPrice: string;
    currency: string;
    travelers: any[];
    flightOffers: any[];
    seatings?: { segmentId: string; travelerId: string; seatNumber: string }[];
  }): string {
    const flightOffer = booking.flightOffers?.[0];

    const travelersHtml = booking.travelers
      .map(
        (t) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${t.name?.firstName} ${t.name?.lastName}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${t.travelerType ?? '–'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${t.contact?.emailAddress ?? '–'}</td>
        </tr>`,
      )
      .join('');

    const itinerariesHtml = flightOffer?.itineraries
      ?.map((it: any, idx: number) => {
        const label = idx === 0 ? 'Outbound' : 'Return';
        const segmentsHtml = it.segments
          .map((s: any, sIdx: number) => {
            const seat = booking.seatings?.find(
              (seat) => seat.segmentId === s.id && seat.travelerId === '1',
            );
            const layoverHtml =
              sIdx < it.segments.length - 1
                ? `<tr><td colspan="4" style="padding:4px 12px;background:#fff8e1;font-size:12px;color:#f59e0b;text-align:center;">
                     Layover at ${s.arrival.iataCode}
                   </td></tr>`
                : '';
            return `
              <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
                  <strong>${s.departure.iataCode}</strong>${s.departure.terminal ? ` T${s.departure.terminal}` : ''}<br/>
                  <span style="color:#6b7280;font-size:13px;">${this.formatDateTime(s.departure.at)}</span>
                </td>
                <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">→</td>
                <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
                  <strong>${s.arrival.iataCode}</strong>${s.arrival.terminal ? ` T${s.arrival.terminal}` : ''}<br/>
                  <span style="color:#6b7280;font-size:13px;">${this.formatDateTime(s.arrival.at)}</span>
                </td>
                <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#374151;">
                  ${s.carrierCode}${s.number}<br/>
                  ${this.formatDuration(s.duration)}
                  ${seat ? `<br/>Seat: <strong>${seat.seatNumber}</strong>` : ''}
                </td>
              </tr>
              ${layoverHtml}`;
          })
          .join('');

        return `
          <h3 style="margin:24px 0 8px;color:#1f2937;">${label} Flight</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;">Departure</th>
                <th style="padding:10px 12px;"></th>
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;">Arrival</th>
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;">Flight</th>
              </tr>
            </thead>
            <tbody>${segmentsHtml}</tbody>
          </table>`;
      })
      .join('') ?? '';

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;letter-spacing:-0.5px;">SkyTrackr</h1>
              <p style="margin:8px 0 0;color:#e0f2fe;font-size:15px;">Your booking is confirmed!</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">

              <!-- PNR hero block -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Your Booking Reference (PNR)</p>
                    <p style="margin:0;font-size:36px;font-weight:800;color:#0ea5e9;letter-spacing:6px;font-family:monospace;">${booking.pnr || '–'}</p>
                    <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Use this code + your last name to track your booking</p>
                  </td>
                  <td style="padding:20px 24px;text-align:right;border-left:1px solid #bae6fd;">
                    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Order ID</p>
                    <p style="margin:0;font-size:12px;font-weight:600;color:#374151;font-family:monospace;">${booking.amadeusOrderId}</p>
                    <span style="display:inline-block;margin-top:8px;padding:3px 10px;background:#dcfce7;color:#16a34a;border-radius:99px;font-size:12px;font-weight:600;">
                      ${booking.status}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Track your booking -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${process.env.FRONTEND_URL ?? '#'}/booking/track?pnr=${booking.pnr ?? ''}"
                   style="display:inline-block;padding:12px 28px;background:#6366f1;color:#ffffff;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
                  Track Your Booking
                </a>
              </div>

              <!-- Itineraries -->
              ${itinerariesHtml}

              <!-- Travelers -->
              <h3 style="margin:28px 0 8px;color:#1f2937;">Passengers</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;">Name</th>
                    <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;">Type</th>
                    <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;">Email</th>
                  </tr>
                </thead>
                <tbody>${travelersHtml}</tbody>
              </table>

              <!-- Price summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="background:#f9fafb;">
                  <td style="padding:14px 20px;font-size:15px;color:#374151;">Total Price</td>
                  <td style="padding:14px 20px;text-align:right;font-size:20px;font-weight:700;color:#1f2937;">
                    ${booking.currency} ${parseFloat(booking.totalPrice).toFixed(2)}
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                Questions? Reply to this email or visit <a href="${process.env.FRONTEND_URL ?? '#'}" style="color:#6366f1;">SkyTrackr</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async sendPriceDropAlert(params: {
    email: string;
    origin: string;
    destination: string;
    departureDate: string;
    initialPrice: number;
    currentPrice: number;
    currency: string;
    watchlistId: string;
  }) {
    const { email, origin, destination, departureDate, initialPrice, currentPrice, currency, watchlistId } = params;
    const saving = (initialPrice - currentPrice).toFixed(2);
    const pct = Math.round(((initialPrice - currentPrice) / initialPrice) * 100);

    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: `Price drop alert: ${origin} → ${destination} is now ${currency} ${currentPrice.toFixed(2)}`,
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#10b981,#0ea5e9);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;letter-spacing:-0.5px;">SkyTrackr</h1>
              <p style="margin:8px 0 0;color:#d1fae5;font-size:15px;">Price Drop Alert</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:16px;color:#374151;">
                <strong>${origin}</strong> &rarr; <strong>${destination}</strong>
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Departing ${departureDate}</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="text-align:center;padding:16px;background:#f9fafb;border-radius:8px 0 0 8px;border:1px solid #e5e7eb;">
                    <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;text-transform:uppercase;">Was</p>
                    <p style="margin:0;font-size:20px;font-weight:600;color:#6b7280;text-decoration:line-through;">${currency} ${initialPrice.toFixed(2)}</p>
                  </td>
                  <td style="text-align:center;padding:16px;background:#ecfdf5;border-radius:0 8px 8px 0;border:1px solid #6ee7b7;">
                    <p style="margin:0 0 4px;font-size:12px;color:#10b981;text-transform:uppercase;">Now</p>
                    <p style="margin:0;font-size:28px;font-weight:800;color:#059669;">${currency} ${currentPrice.toFixed(2)}</p>
                  </td>
                </tr>
              </table>

              <div style="display:inline-block;background:#dcfce7;border-radius:99px;padding:8px 20px;margin-bottom:28px;">
                <span style="font-size:15px;font-weight:700;color:#16a34a;">You save ${currency} ${saving} (${pct}% off)</span>
              </div>

              <br/>
              <a href="${process.env.FRONTEND_URL ?? '#'}/watchlist/${watchlistId}"
                 style="display:inline-block;padding:12px 32px;background:#10b981;color:#ffffff;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
                Book Now
              </a>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                You're receiving this because you're watching this route on
                <a href="${process.env.FRONTEND_URL ?? '#'}" style="color:#0ea5e9;">SkyTrackr</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      });
      this.logger.log(`Price drop alert sent to ${email} for ${origin}→${destination}`);
    } catch (error: any) {
      this.logger.error('Failed to send price drop alert', error.message);
    }
  }

  async sendOtpEmail(fname: string, email: string, otp: string, otpExpires: Date) {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Verify your SkyTrackr account',
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;letter-spacing:-0.5px;">SkyTrackr</h1>
              <p style="margin:8px 0 0;color:#e0f2fe;font-size:15px;">Email Verification</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;text-align:center;">
              <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;">Hi ${fname}!</h2>
              <p style="margin:0 0 28px;color:#6b7280;font-size:15px;">Use the code below to verify your account. It expires in 10 minutes.</p>
              <div style="display:inline-block;background:#f0f9ff;border:2px dashed #0ea5e9;border-radius:12px;padding:20px 48px;margin-bottom:24px;">
                <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#0ea5e9;">${otp}</span>
              </div>
              <p style="margin:0;color:#9ca3af;font-size:13px;">Expires at ${otpExpires.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">If you didn't create a SkyTrackr account, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      });
      this.logger.log(`OTP email sent to ${email}`);
    } catch (error: any) {
      this.logger.error('Failed to send OTP email', error.message);
    }
  }

  async sendPasswordResetEmail(fname: string, email: string, resetLink: string) {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Reset your SkyTrackr password',
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;letter-spacing:-0.5px;">SkyTrackr</h1>
              <p style="margin:8px 0 0;color:#e0f2fe;font-size:15px;">Password Reset</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;text-align:center;">
              <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;">Hi ${fname}!</h2>
              <p style="margin:0 0 28px;color:#6b7280;font-size:15px;">We received a request to reset your password. Click the button below — the link expires in 15 minutes.</p>
              <a href="${resetLink}" style="display:inline-block;background:#0ea5e9;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;margin-bottom:24px;">Reset Password</a>
              <p style="margin:0;color:#9ca3af;font-size:12px;">Or copy this link into your browser:<br/><span style="color:#0ea5e9;word-break:break-all;">${resetLink}</span></p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">If you didn't request a password reset, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error: any) {
      this.logger.error('Failed to send password reset email', error.message);
    }
  }

  private formatDateTime(at: string): string {
    const d = new Date(at);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  private formatDuration(duration: string): string {
    return duration.replace('PT', '').replace('H', 'h ').replace('M', 'm').toLowerCase();
  }
}
