import unittest

from whatsapp_pricing import estimate_monthly_cost, get_rate, list_markets


class CostRules(unittest.TestCase):
    def test_lookup(self):
        self.assertEqual(get_rate("nl", "marketing")["market"], "Netherlands")
        self.assertEqual(get_rate("Germany", "utility")["matched_by"], "country")
        self.assertEqual(get_rate("BE", "utility")["market"], "Rest of Western Europe")
        self.assertEqual(get_rate("ZZ", "marketing")["matched_by"], "other")

    def test_free_service_allowance(self):
        r = get_rate("NL", "service")["rate"]
        self.assertEqual(estimate_monthly_cost("NL", service=1000)["total"], 0)
        self.assertEqual(estimate_monthly_cost("NL", service=1500)["total"], round(500 * r, 6))
        self.assertEqual(estimate_monthly_cost("NL", service=1500, phone_numbers=2)["total"], 0)

    def test_totals(self):
        e = estimate_monthly_cost("NL", marketing=100, utility=100)
        self.assertAlmostEqual(e["total"], e["lines"]["marketing"]["cost"] + e["lines"]["utility"]["cost"])
        self.assertGreater(e["total"], 0)

    def test_bad_input(self):
        with self.assertRaises(ValueError):
            estimate_monthly_cost("NL", marketing=-1)
        self.assertGreater(len(list_markets()), 40)


if __name__ == "__main__":
    unittest.main()
