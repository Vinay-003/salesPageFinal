# Sales Page Implementation (Simple Notes)

## Project Scope (What I actually built)

- I first mimicked the Obesity Killer product page layout for context.
- My actual implementation work is focused on two things only:
	- Sales banner
	- Chart analysis (live order activity section)
- I did not build a separate standalone sales page from scratch.

## Part 1: UI/UX (What user sees and why)

### Why I integrated into the product page
I chose to add the sales banner inside the product page because it is more effective in the real buying flow. If the banner was in a separate section/page, urgency and conversion impact would be weaker. Integrating it in the product page shows the work in its intended context and makes the feature easier to evaluate.

### Goal
The page is built to help users decide fast: first build trust, then show urgency, then make buying easy.

### What we show
- Product images, benefits, and ratings: to build trust quickly.
- 50% offer + countdown + remaining stock: to show this is a limited-time, limited-quantity sale.
- Plan and quantity options + live price: so users can choose clearly without confusion.
- Coupon, guarantee, and payment icons: to reduce hesitation before checkout.
- Live orders chart + recent purchase ticker: to show that people are actively buying.

### Design approach
- Orange is used for action and highlights; red is used when urgency is high.
- Small live animations (timer pulse/tick) make the page feel active, not static.
- Layout is responsive, and gallery interactions work well on touch devices.

---

## Part 2: Logic (How order vs time works)

### 1) Order simulation logic
- Stock starts at 500, with a 6-hour sale session.
- Every 3 seconds, the app simulates new orders.
- Sales follow a realistic curve: fast in the beginning, steady in the middle, slower near the end.
- Random noise/spikes are added so it feels natural, not machine-like.
- Orders never go below zero, and simulation stops when stock is sold out.

### 2) Countdown handling
- End time is saved in sessionStorage (sale-countdown-end).
- First load sets 6 hours; refresh in same session keeps the same timer.
- Timer updates every second in HH:MM:SS format.
- Under 1 hour, timer style switches to urgent state.

### 3) Chart data updates
- On each simulation tick, one point is added: time offset, orders in that tick, and stock left.
- Recent orders (last 5 minutes) are calculated from timestamped drop history.
- Chart supports zoom windows and All mode.
- Rendering updates line, area fill, dots, tooltip, and stats together so UI always stays in sync.