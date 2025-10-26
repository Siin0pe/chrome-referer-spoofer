# Referer Spoofer - Chrome Extension

**Referer Spoofer** is a Chrome extension that allows users to set a custom Referer header for their HTTP requests. This tool is particularly useful for developers who need to test referer-based functionalities or simulate traffic sources in web applications.

![Referer Spoofer Extension Screenshot](./image/image-presentation.png)

## Features

- **Easy Customization**: Set a custom Referer header through a user-friendly interface.
- **Instant Page Refresh**: Automatically refreshes the page after applying or removing the referer.
- **Referer Removal**: Quickly reset and remove the custom Referer header.
- **Dynamic Rules Management**: Implements rules dynamically to modify HTTP headers without requiring page reloads.
- **Error Handling**: Improved error handling ensures smooth user experience and feedback for invalid inputs or system issues.
- **Developer-Friendly**: Ideal for testing behaviors related to referer-based traffic and redirections.

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/yourusername/referer-spoofer-extension.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** by toggling the switch in the upper right corner.
4. Click on **Load unpacked** and select the `src` folder from the cloned repository.
5. The extension should now appear in your toolbar.

## Usage

1. Click on the **Referer Spoofer** icon in the Chrome toolbar.
2. To set a custom referer:
   - Enter the URL you want to use as the referer in the input field.
   - Click on **Set Referer** to apply the custom header.
3. To remove the custom referer:
   - Click on **Delete Referer** to reset to the default behavior.
4. The page will automatically refresh after applying or removing the referer.

## Permissions Justification

This extension requires the following permissions to function properly:

- **declarativeNetRequest**: To modify outgoing HTTP request headers, allowing the custom referer to be set or removed dynamically.
- **activeTab**: To interact with the current active tab where the user has enabled the extension.
- **storage**: To save the custom referer temporarily for reuse.
- **scripting**: To inject a script that refreshes the page after applying or removing the referer.
- **Host Access Permission**: To modify request headers on specified domains chosen by the user.

Each of these permissions is essential for providing the extension's core functionality and is used strictly in line with its purpose.

## Development

If you'd like to contribute or modify this extension:

1. Fork this repository.
2. Make your changes in a new branch.
3. Submit a pull request for review.

Please ensure your code follows the repository's coding guidelines and includes comments where necessary.

## Contributing

Contributions are welcome! If you have ideas or suggestions to improve this extension, feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or support, please reach out on [GitHub](https://github.com/Siin0pe).

---

This extension was created to simplify the process of customizing HTTP referer headers for developers. Use responsibly and in compliance with each website’s terms of service.
