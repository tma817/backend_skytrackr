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
    console.log(recipients)

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
        (t, idx) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:28px;height:28px;background:#2a2a2a;border-radius:50%;text-align:center;vertical-align:middle;font-size:11px;font-weight:700;color:#9ca3af;">${idx + 1}</td>
                <td style="padding-left:12px;">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#ffffff;text-transform:uppercase;">${t.name?.firstName} ${t.name?.lastName}</p>
                  <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">${t.contact?.emailAddress ?? '–'}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`,
      )
      .join('');

    const itinerariesHtml = flightOffer?.itineraries
      ?.map((it: any, idx: number) => {
        const label = idx === 0 ? 'Outbound' : 'Return';
        const firstSeg = it.segments[0];
        const lastSeg = it.segments[it.segments.length - 1];

        const segmentsHtml = it.segments
          .map((s: any, sIdx: number) => {
            const seat = booking.seatings?.find(
              (seat) => seat.segmentId === s.id && seat.travelerId === '1',
            );
            const isLast = sIdx === it.segments.length - 1;
            return `
              <tr>
                <td style="padding:10px 0;${!isLast ? 'border-bottom:1px dashed #2a2a2a;' : ''}">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width:33%;">
                        <p style="margin:0;font-size:16px;font-weight:800;color:#ffffff;">${s.departure.iataCode}</p>
                        <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">${this.formatDateTime(s.departure.at)}</p>
                        ${s.departure.terminal ? `<p style="margin:1px 0 0;font-size:10px;color:#4b5563;">T${s.departure.terminal}</p>` : ''}
                      </td>
                      <td style="width:33%;text-align:center;">
                        <p style="margin:0;font-size:10px;font-weight:600;color:#6b7280;">${this.formatDuration(s.duration)}</p>
                        <p style="margin:4px 0;font-size:1px;color:#3a3a3a;">───────</p>
                        <p style="margin:0;font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:1px;">${s.carrierCode}${s.number}${seat ? ` · <span style="color:#ffffff;">Seat ${seat.seatNumber}</span>` : ''}</p>
                      </td>
                      <td style="width:33%;text-align:right;">
                        <p style="margin:0;font-size:16px;font-weight:800;color:#ffffff;">${s.arrival.iataCode}</p>
                        <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">${this.formatDateTime(s.arrival.at)}</p>
                        ${s.arrival.terminal ? `<p style="margin:1px 0 0;font-size:10px;color:#4b5563;">T${s.arrival.terminal}</p>` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ${!isLast ? `<tr><td style="padding:4px 0;text-align:center;font-size:11px;color:#4b5563;">Layover at ${s.arrival.iataCode}</td></tr>` : ''}`;
          })
          .join('');

        return `
          <!-- Itinerary ${idx + 1} -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;background:#1a1a1a;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:12px 16px;background:#222222;border-bottom:1px solid #2a2a2a;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <span style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:2px;">${label}</span>
                    </td>
                    <td style="text-align:right;">
                      <span style="font-size:10px;font-weight:700;color:#6b7280;">${this.formatDuration(it.duration)} total</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 16px 12px;">
                <!-- Route overview -->
                <table width="100%" cellpadding="0" cellspacing="0" style="padding:12px 0;border-bottom:1px solid #2a2a2a;">
                  <tr>
                    <td>
                      <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${firstSeg?.departure?.iataCode ?? '–'}</p>
                      <p style="margin:2px 0 0;font-size:10px;color:#6b7280;">${firstSeg?.departure?.at ? new Date(firstSeg.departure.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</p>
                    </td>
                    <td style="text-align:center;">
                      <p style="margin:0;font-size:18px;color:#3a3a3a;">→</p>
                    </td>
                    <td style="text-align:right;">
                      <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${lastSeg?.arrival?.iataCode ?? '–'}</p>
                      <p style="margin:2px 0 0;font-size:10px;color:#6b7280;">${lastSeg?.arrival?.at ? new Date(lastSeg.arrival.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</p>
                    </td>
                  </tr>
                </table>
                <!-- Segments -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                  ${segmentsHtml}
                </table>
              </td>
            </tr>
          </table>`;
      })
      .join('') ?? '';

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#161616;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#000000;padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">SkyTrackr</p>
                  </td>
                  <td style="text-align:right;">
                    <span style="display:inline-block;padding:4px 12px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:99px;font-size:11px;font-weight:700;color:#22c55e;letter-spacing:1px;text-transform:uppercase;">${booking.status}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">

              <!-- PNR -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;border-radius:12px;margin-bottom:24px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:2px;">Booking Reference (PNR)</p>
                    <p style="margin:0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:8px;font-family:monospace;">${booking.pnr || '–'}</p>
                    <p style="margin:8px 0 0;font-size:11px;color:#4b5563;">Use this code + your last name to track your booking</p>
                  </td>
                  <td style="padding:20px 24px;text-align:right;border-left:1px solid #1f1f1f;">
                    <p style="margin:0 0 4px;font-size:10px;color:#4b5563;text-transform:uppercase;letter-spacing:1px;">Order ID</p>
                    <p style="margin:0;font-size:11px;font-weight:600;color:#6b7280;font-family:monospace;">${booking.amadeusOrderId}</p>
                  </td>
                </tr>
              </table>

              <!-- Track button -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${process.env.FRONTEND_URL ?? '#'}/booking/track?pnr=${booking.pnr ?? ''}"
                   style="display:inline-block;padding:13px 32px;background:#ffffff;color:#000000;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
                  Track Your Booking
                </a>
              </div>

              <!-- Itineraries -->
              ${itinerariesHtml}

              <!-- Passengers -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;margin-bottom:16px;overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px;background:#222222;border-bottom:1px solid #2a2a2a;">
                    <span style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:2px;">Passengers</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 16px 12px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                      ${travelersHtml}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:10px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:2px;">Total Charged</p>
                    <p style="margin:4px 0 0;font-size:10px;color:#374151;">All taxes included</p>
                  </td>
                  <td style="padding:16px 20px;text-align:right;">
                    <p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${booking.currency} ${parseFloat(booking.totalPrice).toFixed(2)}</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0a0a0a;padding:20px 32px;text-align:center;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-size:12px;color:#4b5563;">
                Questions? Visit <a href="${process.env.FRONTEND_URL ?? '#'}" style="color:#9ca3af;text-decoration:none;font-weight:600;">SkyTrackr</a>
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
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#161616;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#000000;padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:18px;font-weight:800;color:#ffffff;">SkyTrackr</p>
              <p style="margin:0;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:2px;">Price Drop Alert</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <!-- Route -->
              <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#ffffff;text-align:center;letter-spacing:-0.5px;">${origin} → ${destination}</p>
              <p style="margin:0 0 28px;font-size:12px;color:#6b7280;text-align:center;">Departing ${departureDate}</p>

              <!-- Price comparison -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="width:50%;padding:16px;background:#1a1a1a;border-radius:10px 0 0 10px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:1px;">Was</p>
                    <p style="margin:0;font-size:18px;font-weight:600;color:#4b5563;text-decoration:line-through;">${currency} ${initialPrice.toFixed(2)}</p>
                  </td>
                  <td style="width:50%;padding:16px;background:#222222;border-radius:0 10px 10px 0;text-align:center;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#22c55e;text-transform:uppercase;letter-spacing:1px;">Now</p>
                    <p style="margin:0;font-size:26px;font-weight:800;color:#ffffff;">${currency} ${currentPrice.toFixed(2)}</p>
                  </td>
                </tr>
              </table>

              <!-- Saving badge -->
              <div style="text-align:center;margin-bottom:28px;">
                <span style="display:inline-block;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:99px;padding:8px 20px;font-size:13px;font-weight:700;color:#22c55e;">
                  Save ${currency} ${saving} — ${pct}% off
                </span>
              </div>

              <!-- CTA -->
              <div style="text-align:center;">
                <a href="${process.env.FRONTEND_URL ?? '#'}/watchlist/${watchlistId}"
                   style="display:inline-block;padding:13px 36px;background:#ffffff;color:#000000;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
                  Book Now
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0a0a0a;padding:18px 32px;text-align:center;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-size:12px;color:#4b5563;">
                You're watching this route on <a href="${process.env.FRONTEND_URL ?? '#'}" style="color:#9ca3af;text-decoration:none;font-weight:600;">SkyTrackr</a>.
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
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#161616;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#000000;padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:18px;font-weight:800;color:#ffffff;">SkyTrackr</p>
              <p style="margin:0;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:2px;">Email Verification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;text-align:center;">
              <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Hi ${fname}!</h2>
              <p style="margin:0 0 32px;font-size:14px;color:#6b7280;line-height:1.6;">Use the code below to verify your account. It expires in 10 minutes.</p>

              <!-- OTP box -->
              <div style="display:inline-block;background:#000000;border:1px solid #2a2a2a;border-radius:14px;padding:24px 48px;margin-bottom:20px;">
                <span style="font-size:38px;font-weight:800;letter-spacing:12px;color:#ffffff;font-family:monospace;">${otp}</span>
              </div>

              <p style="margin:0;font-size:12px;color:#4b5563;">Expires at ${otpExpires.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0a0a0a;padding:18px 32px;text-align:center;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-size:12px;color:#4b5563;">If you didn't create a SkyTrackr account, you can safely ignore this email.</p>
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
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111111;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#161616;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#000000;padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:18px;font-weight:800;color:#ffffff;">SkyTrackr</p>
              <p style="margin:0;font-size:11px;font-weight:700;color:#4b5563;text-transform:uppercase;letter-spacing:2px;">Password Reset</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;text-align:center;">
              <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Hi ${fname}!</h2>
              <p style="margin:0 0 32px;font-size:14px;color:#6b7280;line-height:1.6;">We received a request to reset your password. Click the button below — the link expires in 15 minutes.</p>

              <a href="${resetLink}" style="display:inline-block;background:#ffffff;color:#000000;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;margin-bottom:28px;letter-spacing:0.5px;">
                Reset Password
              </a>

              <p style="margin:0;font-size:11px;color:#4b5563;line-height:1.6;">Or copy this link:<br/>
                <span style="color:#6b7280;word-break:break-all;font-family:monospace;font-size:10px;">${resetLink}</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0a0a0a;padding:18px 32px;text-align:center;border-top:1px solid #1f1f1f;">
              <p style="margin:0;font-size:12px;color:#4b5563;">If you didn't request a password reset, you can safely ignore this email.</p>
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

  private formatDuration(duration?: string): string {
    if (!duration) return '';
    return duration.replace('PT', '').replace('H', 'h ').replace('M', 'm').toLowerCase();
  }
}
