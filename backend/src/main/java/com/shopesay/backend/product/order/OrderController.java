package com.shopeasy.backend.order;

import com.shopeasy.backend.product.Product;
import com.shopeasy.backend.product.ProductRepository;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "*")
public class OrderController {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;

    public OrderController(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            ProductRepository productRepository) {

        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.productRepository = productRepository;
    }

    // Get all orders
    @GetMapping
    public List<Order> getOrders() {
        return orderRepository.findAll();
    }

    // Place a demo order
    @PostMapping
    @Transactional
    public Order placeOrder(
            @RequestBody Map<String, Object> request) {

        Order order = new Order();

        order.setCustomerName(
                getRequiredText(request, "customerName"));

        order.setEmail(
                getRequiredText(request, "email"));

        order.setAddress(
                getRequiredText(request, "address"));

        order.setCity(
                getRequiredText(request, "city"));

        order.setPostalCode(
                getRequiredText(request, "postalCode"));

        Object itemsObject = request.get("items");

        if (!(itemsObject instanceof List<?> items)
                || items.isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Your cart is empty.");
        }

        BigDecimal total = BigDecimal.ZERO;

        List<OrderItem> orderItems = new ArrayList<>();

        // Validate products and calculate the total
        for (Object itemObject : items) {

            if (!(itemObject instanceof Map<?, ?> item)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid order item.");
            }

            Long productId = getNumber(item, "productId");
            Long quantity = getNumber(item, "quantity");

            if (quantity <= 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Invalid product quantity.");
            }

            if (quantity > Integer.MAX_VALUE) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Product quantity is too large.");
            }

            Product product = productRepository.findById(productId)
                    .orElseThrow(() ->
                            new ResponseStatusException(
                                    HttpStatus.NOT_FOUND,
                                    "Product not found: " + productId));

            if (product.getPrice() == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Product price is missing.");
            }

            total = total.add(
                    product.getPrice().multiply(
                            BigDecimal.valueOf(quantity)));

            OrderItem orderItem = new OrderItem();

            orderItem.setProductId(productId);
            orderItem.setProductName(product.getName());
            orderItem.setImageUrl(product.getImageUrl());
            orderItem.setQuantity(quantity.intValue());
            orderItem.setUnitPrice(
                    product.getPrice().doubleValue());

            orderItem.setOrder(order);

            orderItems.add(orderItem);
        }

        // Connect the items to the order
        order.setItems(orderItems);
        order.setTotal(total.doubleValue());

        // Save order and items together
        Order savedOrder = orderRepository.save(order);

        // Return the saved order with its items
        return orderRepository.findById(savedOrder.getId())
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.INTERNAL_SERVER_ERROR,
                                "Unable to retrieve the saved order."));
    }

    // Validate required text fields
    private String getRequiredText(
            Map<String, Object> request,
            String field) {

        Object value = request.get(field);

        if (!(value instanceof String text)
                || text.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " is required.");
        }

        return text.trim();
    }

    // Read numeric values from the request
    private Long getNumber(
            Map<?, ?> item,
            String field) {

        Object value = item.get(field);

        if (!(value instanceof Number number)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " must be a number.");
        }

        long result = number.longValue();

        if (result <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " must be greater than zero.");
        }

        if (number.doubleValue() != result) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " must be a whole number.");
        }

        return result;
    }
}