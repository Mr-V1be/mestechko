-- Pairs of bookings that hold the same staff member or resource at overlapping times.
-- Run after a load test; the answer must be 0 rows.
SELECT a.booking_id AS first_booking, b.booking_id AS second_booking, a.staff_id,
       a.occupied AS first_time, b.occupied AS second_time
FROM booking_items a
JOIN booking_items b
  ON a.id < b.id
 AND a.occupied && b.occupied
 AND (a.staff_id = b.staff_id OR (a.resource_id IS NOT NULL AND a.resource_id = b.resource_id))
WHERE a.status IN ('held', 'confirmed', 'completed', 'no_show')
  AND b.status IN ('held', 'confirmed', 'completed', 'no_show');
