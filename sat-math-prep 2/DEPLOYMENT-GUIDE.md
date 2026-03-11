# SAT Math Prep — Deployment Guide

**This guide walks you through getting your SAT Math Prep platform live on the internet in about 20 minutes. No coding required — just creating accounts and copy-pasting.**

---

## What You'll Set Up

| Service | Purpose | Cost |
|---------|---------|------|
| **Supabase** | Database + student accounts | Free (up to 50,000 users) |
| **Vercel** | Hosts your website | Free (unlimited visitors) |
| **GitHub** | Stores your code (Vercel reads it) | Free |

**Total cost: $0/month** for up to 50,000 students.

---

## Step 1: Upload Code to GitHub (5 minutes)

1. Go to **github.com** and sign in
2. Click the **"+"** button in the top-right corner → **"New repository"**
3. Name it `sat-math-prep`
4. Make sure **"Public"** is selected
5. Click **"Create repository"**
6. On the next screen, click **"uploading an existing file"** (blue link)
7. **Drag and drop ALL the files from the unzipped project folder** onto the page
   - Make sure you include the `src` folder, `package.json`, `next.config.mjs`, etc.
   - The `.gitignore` and `.env.local.example` files too
   - Do NOT upload the `supabase-setup.sql` (it's just for the next step)
8. Click **"Commit changes"**

> **Tip:** Make sure the files are at the root level — you should see `package.json` in the main repo view, NOT inside another folder.

---

## Step 2: Set Up Supabase Database (5 minutes)

1. Go to **supabase.com** and click **"Start your project"**
2. Sign up with your GitHub account (easiest)
3. Click **"New Project"**
   - **Name:** `sat-math-prep`
   - **Database Password:** Choose something strong (you won't need this often)
   - **Region:** Pick the closest to your students
4. Click **"Create new project"** and wait ~2 minutes for it to set up

### Run the Database Setup Script

5. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
6. Click **"New query"**
7. Open the file `supabase-setup.sql` from the project folder in any text editor
8. **Copy the ENTIRE contents** and paste it into the SQL Editor
9. Click **"Run"** (the green play button)
10. You should see "Success. No rows returned" — that's correct!

### Get Your API Keys

11. In the left sidebar, click **"Project Settings"** (gear icon at bottom)
12. Click **"API"** under Configuration
13. You'll see two values you need — **keep this page open**, you'll need them in Step 3:
    - **Project URL** (looks like `https://xxxxx.supabase.co`)
    - **anon / public** key (a long string starting with `eyJ...`)

---

## Step 3: Deploy on Vercel (5 minutes)

1. Go to **vercel.com** and click **"Sign Up"**
2. Sign up with your **GitHub account**
3. Click **"Add New..."** → **"Project"**
4. Find `sat-math-prep` in your repository list and click **"Import"**
5. Before clicking Deploy, expand **"Environment Variables"**
6. Add these two variables:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | *(paste your Project URL from Step 2)* |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(paste your anon key from Step 2)* |

7. Click **"Deploy"**
8. Wait 1-2 minutes. When it's done, Vercel gives you a URL like:
   **`sat-math-prep.vercel.app`**

🎉 **Your site is now live!** Share that URL with your students.

---

## Step 4: Make Yourself Admin (2 minutes)

1. Open your live site and **create an account** using your email
2. Go back to **Supabase** → **SQL Editor** → **New query**
3. Paste this, replacing the email with YOUR email:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com');
```

4. Click **"Run"**
5. **Sign out and sign back in** on the site — you'll now see the Admin dashboard

---

## Step 5: Share With Students

Send your students the link (e.g., `sat-math-prep.vercel.app`) and tell them to:
1. Click **"Create account"**
2. Enter their name, email, and a password
3. They're in! They can take practice exams and assigned exams immediately

---

## Optional: Custom Domain ($12/year)

Want `satprep.yourdomain.com` instead of `sat-math-prep.vercel.app`?

1. Buy a domain from **Namecheap** or **Google Domains** (~$12/year)
2. In Vercel, go to your project → **"Settings"** → **"Domains"**
3. Add your domain and follow Vercel's instructions to update DNS

---

## Troubleshooting

### "Invalid login" when signing in
- Make sure you're using the email and password you registered with
- Check Supabase → Authentication → Users to verify the account exists

### Students can't create accounts
- Go to Supabase → Authentication → Settings
- Make sure "Enable Email Signup" is ON
- Under "Email Auth", make sure "Confirm email" is OFF (or students will need to verify email)

### I don't see the Admin dashboard
- Make sure you ran the SQL to make yourself admin (Step 4)
- You must **sign out and sign back in** after the change

### Deployment failed on Vercel
- Make sure `package.json` is at the root of your GitHub repo (not inside a subfolder)
- Check that both environment variables are set correctly in Vercel

### Need to add more admin accounts
Run the same SQL from Step 4 with the other person's email.

---

## Managing Your Platform

### Day-to-day
- **Create exams:** Admin dashboard → "+ Create Exam"
- **View student progress:** Admin dashboard → "Students" (click a name for details)
- **Analytics:** Admin dashboard → "Analytics" (filter by student)

### Adding more questions
Come back to Claude with your past SAT exams, and I'll generate new questions to add to the question bank. You'll just update one file (`src/lib/questions.js`) and push to GitHub — Vercel auto-redeploys.

---

**That's it! Your platform is live, free, and students can sign up forever just by visiting the link.**
