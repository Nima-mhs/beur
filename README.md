# BEUR SEASON — وب‌سایت برند شخصی

**Beauty Your Season** · مشاوره زیبایی داده‌محور · Color Science

سایت رسمی برند BEUR SEASON: معرفی خدمات، رزرو و پرداخت آنلاینِ جلسه‌ی مشاوره‌ی رنگ، و در آینده وبینار و کلاس آنلاین.

---

## تکنولوژی

| لایه | ابزار |
|------|------|
| فریم‌ورک | Next.js 14 (App Router) + TypeScript |
| استایل | Tailwind CSS (پالت برند) |
| دوزبانگی | next-intl — فارسی (RTL، پیش‌فرض) + انگلیسی (LTR) |
| فونت | Vazirmatn (فارسی/بدنه) + Cormorant Garamond (تیتر انگلیسی) |
| دیتابیس و احراز هویت | Supabase _(فاز ۲ به بعد)_ |
| پرداخت | Stripe (بین‌المللی) + زرین‌پال (ایران) _(فاز ۴)_ |
| استقرار | Vercel |

## اجرای محلی

> روی این سیستم Node به‌صورت portable نصب شده. اگر `node` شناخته نشد، اول این مسیر را به PATH اضافه کنید:
> `C:\Users\ASUS\AppData\Local\nodejs-portable\node-v22.11.0-win-x64`

```bash
npm install
npm run dev
```

سپس مرورگر را روی <http://localhost:3000> باز کنید (به‌صورت خودکار به `/fa` هدایت می‌شود).

## ساختار

```
messages/                fa.json · en.json  (تمام متن‌های سایت)
public/                  favicon و دارایی‌های استاتیک
src/
  i18n/                  پیکربندی next-intl (routing, request, navigation)
  middleware.ts          مسیریابی زبان
  app/[locale]/          صفحات: خانه، درباره من، خدمات، مشاوره
  components/            Navbar, Footer, Logo, LanguageSwitcher
  components/sections/   بخش‌های صفحه‌ی اصلی (Hero, Values, ...)
```

## فازهای توسعه

- [x] **فاز ۰** — راه‌اندازی پروژه و هویت بصری برند
- [x] **فاز ۱** — صفحات اصلی (خانه، درباره من، خدمات، مشاوره)
- [ ] **فاز ۲** — احراز هویت (ایمیل + گوگل) و داشبورد کاربر
- [ ] **فاز ۳** — سیستم رزرو (تقویم، ساعت‌های خالی)
- [ ] **فاز ۴** — پرداخت (Stripe + زرین‌پال)
- [ ] **فاز ۵** — تکمیل، ایمیل تأیید، SEO
- [ ] **آینده** — ورود پیامکی OTP، پنل ادمین، وبینار/کلاس آنلاین

## متغیرهای محیطی

از `.env.local.example` یک کپی به‌نام `.env.local` بسازید و مقادیر واقعی Supabase / Stripe / زرین‌پال را پر کنید (در فازهای بعد).

---

*BEUR SEASON · Beauty Your Season*
