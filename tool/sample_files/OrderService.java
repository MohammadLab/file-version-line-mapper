package tool.sample_files;

public class OrderService {

    // simple in-memory order counter
    private int nextOrderId = 1;

    public OrderService() {
        // default constructor
    }

    public int createOrder(String customer, double amount) {
        if (customer == null || customer.isBlank()) {
            throw new IllegalArgumentException("customer is required");
        }

        int orderId = nextOrderId++;
        log("Created order " + orderId + " for " + customer);
        double tax = calculateTax(amount);
        double total = amount + tax;
        save(orderId, customer, total);
        return orderId;
    }

    private double calculateTax(double amount) {
        double rate = 0.13; // HST
        return amount * rate;
    }

    private void save(int id, String customer, double total) {
        // pretend to write to database
        System.out.println("Saving order " + id + " for " + customer + " total=" + total);
    }

    public void cancelOrder(int orderId) {
        if (orderId <= 0) {
            throw new IllegalArgumentException("orderId must be positive");
        }

        log("Cancelling order " + orderId);
        // TODO: reverse payment
    }

    private void log(String message) {
        System.out.println("[OrderService] " + message);
    }

    public static void main(String[] args) {
        OrderService service = new OrderService();
        int id = service.createOrder("Alice", 100.0);
        service.cancelOrder(id);
    }
}