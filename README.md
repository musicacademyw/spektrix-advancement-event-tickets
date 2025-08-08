# Spektrix Advancement Event Ticket Purchase Path

A modern, embeddable event ticketing interface built with Svelte that integrates with the Spektrix v3 client-side API to
handle the purchase path for the Music Academy's advancement events.

## 🎯 Features

- **Multi-Event Support**: Display and sell tickets for multiple events simultaneously
- **Dynamic Query Parameters**: Event IDs passed via URL query parameters (`?eventIds=EVENT1,EVENT2`)
- **Real-time Availability**: Automatic refresh of ticket availability with smart user presence detection
- **Responsive Design**: Built with Tailwind CSS and Skeleton UI components
- **iFrame Embeddable**: Designed to work seamlessly within iFrames with automatic height resizing
- **Shopping Cart**: Add tickets to basket with attendee information collection
- **Smart Refresh**: Only refreshes availability when user is actively present (prevents unnecessary API calls)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Access to a Spektrix system

### Installation

```bash
# Clone the repository
git clone https://github.com/musicacademyw/spektrix-advancement-event-tickets.git
cd spektrix-advancement-event-tickets

# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration

1. **Spektrix API Configuration**: Update the `SPEKTRIX_BASE_URL` in `src/services/spektrix.js`:
   ```javascript
   const SPEKTRIX_BASE_URL = 'https://spektrix.yourdomain.org/yourinstance/api/v3';
   ```

2. **Website Base URL**: Update `WEBSITE_BASE_URL` in `src/App.svelte` for checkout redirects:
   ```javascript
   const WEBSITE_BASE_URL = 'https://yourdomain.org';
   ```

## 📖 Usage

### Development

```bash
npm run dev
```

Access the application at `http://localhost:5173/?eventIds=YOUR_EVENT_ID`

### Building for Production

```bash
npm run build
```

Deploy the `dist` folder to your web server.

### URL Parameters

The application uses query parameters to determine which events to display:

- **Single Event**: `?eventIds=EVENT_ID_123`
- **Multiple Events**: `?eventIds=EVENT_ID_1,EVENT_ID_2,EVENT_ID_3`
- **No Events**: Shows error message if no `eventIds` parameter provided

## 🔧 iFrame Embedding

### Basic Embedding

```html

<iframe
        data-iframe-id="unique-id-for-this-iframe"
        src="https://your-domain.org?eventIds=EVENT_ID_123"
        width="100%"
        height="600px"
        frameborder="0"
        scrolling="no"
        style="border: none; overflow: hidden; transition: height 0.3s ease;">
</iframe>
```

### Auto-Resizing iFrame

Include this JavaScript on your parent page to enable automatic height resizing:

```javascript
window.addEventListener('message', function (event) {
    // Security: Only accept messages from your tickets domain
    if (event.origin !== 'https://your-tickets-domain.org') {
        return;
    }

    if (event.data.type === 'iframe-height-update' &&
        event.data.source === 'advancement-tickets') {

        const iframeId = event.data.iframeId;
        const iframe = document.querySelector(`[data-iframe-id="${iframeId}"]`);

        if (iframe) {
            const newHeight = event.data.height + 20; // Add padding
            iframe.style.height = newHeight + 'px';
        }
    }
});
```

### Navigation Handling

For checkout redirects to work within iFrames, the application will redirect the parent window:

```javascript
// Redirects the parent window for checkout
window.parent.location.href = checkoutUrl;
```

## 🏗️ Architecture

### Project Structure

```
src/
├── App.svelte              # Main application component
├── main.js                 # Application entry point
├── toaster.js             # Toast notification service
├── components/
│   ├── EventCard.svelte   # Individual event display
│   ├── EventBasketSummary.svelte  # Shopping cart summary
│   └── AttendeeForm.svelte # Attendee information collection
└── services/
    └── spektrix.js        # Spektrix API integration
```

### Key Components

#### App.svelte

- Main application logic
- Event ID parsing from URL
- User presence detection
- Automatic availability refresh
- iFrame height communication

#### EventCard.svelte

- Individual event display
- Ticket selection interface
- Instance (date/time) selection
- Price tier handling

#### EventBasketSummary.svelte

- Shopping cart functionality
- Attendee information collection
- Checkout initiation

#### SpektrixService

- API communication with Spektrix
- Event details, instances, availability
- Basket management
- Checkout URL generation

## 🔄 User Presence Detection

The application implements smart refresh logic to avoid unnecessary API calls:

- **Activity Tracking**: Mouse movement, clicks, keyboard input, scrolling
- **Visibility API**: Detects when browser tab/window is hidden
- **Timeout Logic**: Stops refreshing after 5 minutes of inactivity
- **iFrame Compatible**: Works within embedded iFrames

## 🎨 Styling

Built with:

- **Tailwind CSS 4.x**: Utility-first CSS framework
- **Skeleton UI**: Pre-built Svelte components
- **Lucide Svelte**: Icon library
- **Custom CSS**: Music Academy theme integration

## 🚀 Deployment

### GitHub Pages

The application is configured for GitHub Pages deployment with the `base: ""` setting in `vite.config.js`.

### Custom Domain

For custom domain deployment:

1. Update API URLs in `spektrix.js`
2. Configure CORS settings on your Spektrix system
3. Update the proxy configuration in `vite.config.js` for development

## 🔒 Security Considerations

- **CORS Configuration**: Ensure your Spektrix system allows requests from your domain
- **iFrame Security**: The application validates message origins for height resizing
- **Cookie Handling**: Proxy configuration maintains session cookies for basket functionality

## 🐛 Troubleshooting

### Common Issues

1. **Events not loading**: Check event IDs in URL and Spektrix API connectivity
2. **iFrame height not updating**: Verify the parent page JavaScript is included
3. **Checkout redirect not working**: Ensure proper sandbox permissions on iFrame
4. **CORS errors**: Configure Spektrix CORS settings for your domain

### Development Proxy

The development server includes a proxy to the Spektrix API to avoid CORS issues during development. This proxy forwards
cookies and headers to maintain session state.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.md) file for details.