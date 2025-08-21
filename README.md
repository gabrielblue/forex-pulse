# Welcome to your Lovable project

## 🚀 Real Exness MT5 Integration Setup

This project includes REAL MetaTrader 5 integration for live forex trading. To use real trading features:

1. **Install Python dependencies**: `pip install -r requirements.txt`
2. **Start MT5 Bridge**: `python mt5_bridge.py`
3. **Open MT5 Terminal** and login to your Exness account
4. **Connect in the app** using your real MT5 credentials

See `MT5_SETUP_INSTRUCTIONS.md` for detailed setup instructions.

⚠️ **IMPORTANT**: Always test with demo accounts first before using live accounts with real money.

## Project info

**URL**: https://lovable.dev/projects/38592b26-5b86-46ca-b10b-1f2258472be4

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/38592b26-5b86-46ca-b10b-1f2258472be4) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/38592b26-5b86-46ca-b10b-1f2258472be4) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Security Setup

Create a `.env` file based on `.env.example` and set:

```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_MT5_BRIDGE_URL=<bridge_url_or_leave_default>
```

Do not commit real keys. Never expose `SUPABASE_SERVICE_ROLE_KEY` in the frontend.

Run migrations to enforce RLS policies:

```
supabase db push
```

Review Supabase Auth security settings:
- Enable leaked password protection
- Set OTP expiry to 60–120 seconds

See Supabase docs for recommended production hardening.
