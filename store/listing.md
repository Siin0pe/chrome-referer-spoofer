# Chrome Web Store listing

## Name
Referer Spoofer

## Summary (manifest description, max 132 characters)
Change or remove the HTTP Referer header, globally or per site. Set a custom referer for each domain and test referral traffic.

## Category
Developer Tools

## Description

Referer Spoofer lets you change the HTTP Referer header Chrome sends, for every site or only for the sites you choose. Set a fake referer, give each domain its own referer, or remove the Referer header completely, then reload the tab and see the result.

Two modes
• Simple: one referer for all websites, one button
• Advanced: a full list of rules, one per site or URL pattern
Both show the same rules, so you can switch at any time.

What you can do
• Set a custom Referer header for all websites in one click
• Use a different referer for each website: domains, subdomains or URL patterns such as example.com/shop/*
• Remove the Referer header entirely (strip referrer) on the sites you pick
• Spoof the referer only on links coming from another site, so links inside the same site keep their real referer
• Apply the referer to the page only, or also to iframes, images, scripts, fetch and XHR API calls
• Turn each rule on or off without deleting it
• Rules switch off when Chrome restarts, or stay on if you prefer (your list is always kept)

Who it is for
• Web developers testing referer checks, redirects and hotlink protection
• Marketers and SEO specialists checking referral traffic and analytics attribution (Google, Facebook, Twitter/X, partner sites)
• QA testers reproducing traffic from a specific source
• Anyone who wants to hide or control the referrer sent to websites

How it works
Referer Spoofer uses Chrome's declarativeNetRequest API to rewrite the Referer request header before it leaves the browser. No proxy, no tracking, no data collection, and nothing is sent anywhere. Your rules stay in your browser.

Note: the extension changes the header received by the server. A page's own JavaScript (document.referrer) still sees the browser's original value.

Open source on GitHub: https://github.com/Siin0pe/chrome-referer-spoofer

## Permission justifications
- declarativeNetRequest: rewrites or removes the Referer request header according to the rules the user creates.
- storage: saves the user's rules and the "keep rules after restart" setting locally.
- Host permissions (<all_urls>): Chrome only lets an extension modify request headers on sites it has host access to, and users choose which sites their rules apply to, which can be any site.

## Single purpose
Modify or remove the HTTP Referer request header on the sites the user chooses.

## Data usage
The extension does not collect or transmit any user data.

## Screenshots (1280x800)
store/1-simple.png, store/2-rules.png, store/3-editor.png, store/4-dark.png

## Promo tiles (JPEG, 24-bit, no alpha)
- Small promo tile 440x280: store/promo-small.jpg
- Marquee 1400x560: store/promo-marquee.jpg
