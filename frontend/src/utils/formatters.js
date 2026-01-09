/**
 * Format Utilities
 * Data formatting and display utilities
 */

export const formatters = {
  // Format date
  formatDate: (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  },

  // Format date and time
  formatDateTime: (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  },

  // Truncate text
  truncate: (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  },

  // Capitalize first letter
  capitalize: (text) => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  },

  // Format status as badge
  formatStatus: (status) => {
    const statuses = {
      draft: '📝 Draft',
      published: '✅ Published',
      archived: '📦 Archived',
      pending: '⏳ Pending',
      processing: '⚙️ Processing',
      completed: '✅ Completed',
      error: '❌ Error',
    };
    return statuses[status?.toLowerCase()] || status;
  },
};

export default formatters;
