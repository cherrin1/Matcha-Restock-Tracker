const notifier = require('node-notifier');
const path = require('path');

class NotificationService {
  constructor() {
    this.enabled = true;
  }

  sendDesktopNotification(title, message, icon = null) {
    if (!this.enabled) return;

    notifier.notify({
      title: title,
      message: message,
      icon: icon || path.join(__dirname, '../../public/icon.png'),
      sound: true,
      wait: false
    });
  }

  sendRestockAlert(productName, brand) {
    this.sendDesktopNotification(
      '🍵 Matcha Restock Alert!',
      `${productName} from ${brand} is back in stock!`
    );
  }

  disable() {
    this.enabled = false;
  }

  enable() {
    this.enabled = true;
  }
}

module.exports = NotificationService;
