package tool.sample_files;

public class OrderService2 {

    // simple in-memory order counter (thread-unsafe demo only)
    private int nextOrderId = 1;

    public OrderService2() {
        // default constructor, no dependencies yet
    }

    public int createOrder(String customer, double amount) {
        if (customer == null || customer.isBlank()) {
            throw new IllegalArgumentException("customer name is required");
        }

        int orderId = nextOrderId++;
        log("Created order " + orderId + " for " + customer + " amount=" + amount);
        double tax = calculateTax(amount);
        double total = amount + tax;
        save(orderId, customer, total);
        return orderId;
    }

    private double calculateTax(double amount) {
        double rate = 0.13; // HST (Ontario)
        if (amount <= 0) {
            return 0.0;
        }
        return amount * rate;
    }

    private void save(int id, String customer, double total) {
        // pretend to write to database (later: swap with repository)
        System.out.println("Saving order "
             + id + " for " + customer + " total=" + total);
    }

    public void cancelOrder(int orderId) {
        if (orderId <= 0) {
            throw new IllegalArgumentException("orderId must be positive");
        }

        log("Cancelling order " + orderId + " and issuing refund");
        // TODO: reverse payment and notify accounting
    }

    public boolean isHighValue(double amount) {
        // arbitrary threshold for demo purposes
        return amount >= 1000.0;
    }

    private void log(String message) {
        System.out.println("[OrderService] " + message);
    }

    public static void main(String[] args) {
        OrderService2 service = new OrderService2();
        int id = service.createOrder("Bob", 150.0);
        if (service.isHighValue(150.0)) {
            System.out.println("High value order!");
        }
        service.cancelOrder(id);
    }
}
