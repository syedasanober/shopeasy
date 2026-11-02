package com.shopeasy.backend.product;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;

    // Constructor: connects this controller to the product database repository
    public ProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    // Get products with search, category filtering, and pagination
    @GetMapping
    public Map<String, Object> getProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {

        // Prevent invalid page numbers and excessively large page sizes
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));

        // Convert empty search and category values into null
        q = cleanValue(q);
        category = cleanValue(category);

        // Find products matching the search and category
        List<Product> matchingProducts =
                productRepository.searchProducts(q, category);

        // Calculate which products belong on this page
        long startPosition = (long) safePage * safeSize;

        int start = (int) Math.min(
                startPosition,
                matchingProducts.size()
        );

        int end = Math.min(
                start + safeSize,
                matchingProducts.size()
        );

        List<Product> content =
                matchingProducts.subList(start, end);

        // Prepare the response expected by the frontend
        Map<String, Object> response = new HashMap<>();

        response.put("content", content);

        response.put(
                "totalPages",
                (int) Math.ceil(
                        (double) matchingProducts.size() / safeSize
                )
        );

        response.put("totalElements", matchingProducts.size());
        response.put("number", safePage);
        response.put("size", safeSize);

        return response;
    }

    // Get all available product categories
    @GetMapping("/categories")
    public List<String> getCategories() {

        return productRepository.findAll()
                .stream()
                .map(Product::getCategory)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    // Get one product using its ID
    @GetMapping("/{id}")
    public Product getProductById(@PathVariable Long id) {

        return productRepository.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Product not found"
                        )
                );
    }

    // Add a new product
    @PostMapping
    public ResponseEntity<Product> createProduct(
            @Valid @RequestBody Product product) {

        // Let the database generate the product ID
        product.setId(null);

        Product savedProduct =
                productRepository.save(product);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(savedProduct);
    }

    // Update an existing product
    @PutMapping("/{id}")
    public Product updateProduct(
            @PathVariable Long id,
            @Valid @RequestBody Product updatedProduct) {

        Product existingProduct =
                productRepository.findById(id)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Product not found"
                                )
                        );

        existingProduct.setName(updatedProduct.getName());
        existingProduct.setCategory(updatedProduct.getCategory());
        existingProduct.setDescription(
                updatedProduct.getDescription()
        );
        existingProduct.setPrice(updatedProduct.getPrice());
        existingProduct.setImageUrl(updatedProduct.getImageUrl());
        existingProduct.setBrand(updatedProduct.getBrand());
        existingProduct.setRating(updatedProduct.getRating());
        existingProduct.setStock(updatedProduct.getStock());

        return productRepository.save(existingProduct);
    }

    // Delete a product
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(
            @PathVariable Long id) {

        if (!productRepository.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Product not found"
            );
        }

        productRepository.deleteById(id);

        return ResponseEntity.noContent().build();
    }

    // Helper method: removes unnecessary spaces
    private String cleanValue(String value) {

        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim();
    }
}