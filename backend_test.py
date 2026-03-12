#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, List

class ContentPulseM3Tester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Test data from agent context
        self.instagram_id = "099b8eebfabc6be266020ae0"
        self.linkedin_id = "cd000faa6cfa0c6f8836d15f"
        self.date_start = "2026-01-01"
        self.date_end = "2026-03-12"

    def log_test(self, name: str, success: bool, response_data: Any = None, error: str = None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED")
            if response_data:
                print(f"   Response sample: {json.dumps(response_data, indent=2)[:200]}...")
        else:
            self.failed_tests.append({"name": name, "error": error})
            print(f"❌ {name}: FAILED - {error}")

    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 params: Dict[str, str] = None, data: Dict[str, Any] = None) -> tuple[bool, Any]:
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        print(f"\n🔍 Testing {name}...")
        print(f"   {method} {url}")
        if params:
            print(f"   Params: {params}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expected_status
            response_data = None
            
            if response.headers.get('content-type', '').startswith('application/json'):
                try:
                    response_data = response.json()
                except:
                    response_data = {"raw_response": response.text[:500]}
            
            if success:
                self.log_test(name, True, response_data)
                return True, response_data
            else:
                error = f"Expected {expected_status}, got {response.status_code}. Response: {response.text[:200]}"
                self.log_test(name, False, error=error)
                return False, response_data

        except Exception as e:
            error = f"Request failed: {str(e)}"
            self.log_test(name, False, error=error)
            return False, None

    def validate_response_structure(self, name: str, response_data: Any, expected_keys: List[str]) -> bool:
        """Validate response has expected structure"""
        if not response_data:
            self.log_test(f"{name} - Structure Check", False, error="No response data")
            return False
        
        # Handle wrapped response (data field)
        actual_data = response_data.get('data', response_data) if isinstance(response_data, dict) else response_data
        
        missing_keys = [key for key in expected_keys if key not in actual_data]
        if missing_keys:
            self.log_test(f"{name} - Structure Check", False, error=f"Missing keys: {missing_keys}")
            return False
        
        self.log_test(f"{name} - Structure Check", True)
        return True

    def test_us301_channel_time_series(self):
        """Test US-301: Per-Channel Time Series with granularity"""
        print("\n" + "="*60)
        print("TESTING US-301: Per-Channel Time Series")
        print("="*60)
        
        # Test 1: Daily granularity with Instagram channel
        success, data = self.run_test(
            "US-301 Daily Granularity (Instagram)",
            "GET",
            f"/api/v1/analytics/channels/{self.instagram_id}",
            200,
            params={
                "start": self.date_start,
                "end": self.date_end,
                "granularity": "daily"
            }
        )
        
        if success and data:
            self.validate_response_structure(
                "US-301 Daily Response", 
                data, 
                ["channelId", "granularity", "timeSeries"]
            )
            
            # Check that daily should have ~30 data points for 30-day period
            actual_data = data.get('data', data)
            time_series = actual_data.get('timeSeries', [])
            if len(time_series) >= 25:  # Allow some flexibility
                self.log_test("US-301 Daily Data Points Count", True)
            else:
                self.log_test("US-301 Daily Data Points Count", False, 
                            error=f"Expected ~30 daily points, got {len(time_series)}")

        # Test 2: Weekly granularity 
        success, data = self.run_test(
            "US-301 Weekly Granularity (LinkedIn)", 
            "GET",
            f"/api/v1/analytics/channels/{self.linkedin_id}",
            200,
            params={
                "start": self.date_start,
                "end": self.date_end,
                "granularity": "weekly"
            }
        )
        
        if success and data:
            # Weekly should have ~10 data points for 70-day period
            actual_data = data.get('data', data)
            time_series = actual_data.get('timeSeries', [])
            if len(time_series) >= 8 and len(time_series) <= 12:
                self.log_test("US-301 Weekly Data Points Count", True)
            else:
                self.log_test("US-301 Weekly Data Points Count", False, 
                            error=f"Expected ~10 weekly points, got {len(time_series)}")

        # Test 3: Monthly granularity
        success, data = self.run_test(
            "US-301 Monthly Granularity (Instagram)",
            "GET", 
            f"/api/v1/analytics/channels/{self.instagram_id}",
            200,
            params={
                "start": self.date_start,
                "end": self.date_end,
                "granularity": "monthly"
            }
        )
        
        if success and data:
            # Monthly should have 3 data points (Jan, Feb, Mar)
            actual_data = data.get('data', data)
            time_series = actual_data.get('timeSeries', [])
            if len(time_series) == 3:
                self.log_test("US-301 Monthly Data Points Count", True)
            else:
                self.log_test("US-301 Monthly Data Points Count", False, 
                            error=f"Expected 3 monthly points, got {len(time_series)}")

        # Test 4: Invalid channel ID format
        success, data = self.run_test(
            "US-301 Invalid Channel ID Format",
            "GET",
            "/api/v1/analytics/channels/invalid-id-format",
            400,
            params={
                "start": self.date_start,
                "end": self.date_end,
                "granularity": "daily"
            }
        )

        # Test 5: Valid but non-existent channel ID
        success, data = self.run_test(
            "US-301 Non-existent Channel ID",
            "GET",
            "/api/v1/analytics/channels/507f1f77bcf86cd799439011",  # Valid ObjectId format but doesn't exist
            404,
            params={
                "start": self.date_start,
                "end": self.date_end,
                "granularity": "daily"
            }
        )

    def test_us302_content_type_breakdown(self):
        """Test US-302: Content Type Performance Breakdown"""
        print("\n" + "="*60)
        print("TESTING US-302: Content Type Performance Breakdown")
        print("="*60)
        
        # Test 1: Content breakdown for Instagram
        success, data = self.run_test(
            "US-302 Content Breakdown (Instagram)",
            "GET",
            f"/api/v1/analytics/channels/{self.instagram_id}/content-breakdown",
            200,
            params={
                "start": self.date_start,
                "end": self.date_end
            }
        )
        
        if success and data:
            self.validate_response_structure(
                "US-302 Response Structure",
                data,
                ["channelId", "contentTypeBreakdown"]
            )
            
            # Validate content type entries structure
            actual_data = data.get('data', data)
            breakdown = actual_data.get('contentTypeBreakdown', [])
            if breakdown:
                first_entry = breakdown[0]
                required_fields = ["postType", "postCount", "avgImpressions", "avgEngagements", "avgEngagementRate"]
                self.validate_response_structure(
                    "US-302 Content Entry Structure",
                    first_entry,
                    required_fields
                )
                
                # Check if sorted by avgEngagementRate descending
                if len(breakdown) > 1:
                    is_sorted = all(breakdown[i]["avgEngagementRate"] >= breakdown[i+1]["avgEngagementRate"] 
                                  for i in range(len(breakdown)-1))
                    if is_sorted:
                        self.log_test("US-302 Sorted by Engagement Rate", True)
                    else:
                        self.log_test("US-302 Sorted by Engagement Rate", False,
                                    error="Content types not sorted by avgEngagementRate desc")

        # Test 2: Content breakdown for LinkedIn
        success, data = self.run_test(
            "US-302 Content Breakdown (LinkedIn)",
            "GET", 
            f"/api/v1/analytics/channels/{self.linkedin_id}/content-breakdown",
            200,
            params={
                "start": self.date_start,
                "end": self.date_end
            }
        )

        # Test 3: Invalid channel ID
        success, data = self.run_test(
            "US-302 Invalid Channel ID",
            "GET",
            "/api/v1/analytics/channels/invalid-id/content-breakdown",
            400,
            params={
                "start": self.date_start,
                "end": self.date_end
            }
        )

    def test_us303_best_posting_times(self):
        """Test US-303: Best Posting Times"""
        print("\n" + "="*60)
        print("TESTING US-303: Best Posting Times")
        print("="*60)
        
        # Test 1: Best posting times for Instagram
        success, data = self.run_test(
            "US-303 Best Posting Times (Instagram)",
            "GET",
            f"/api/v1/analytics/channels/{self.instagram_id}/posting-times",
            200,
            params={
                "start": self.date_start,
                "end": self.date_end
            }
        )
        
        if success and data:
            self.validate_response_structure(
                "US-303 Response Structure",
                data,
                ["channelId", "bestPostingTimes"]
            )
            
            # Validate posting time entries structure
            actual_data = data.get('data', data)
            posting_times = actual_data.get('bestPostingTimes', [])
            if posting_times:
                first_entry = posting_times[0]
                required_fields = ["dayOfWeek", "hour", "avgEngagementRate", "postCount"]
                self.validate_response_structure(
                    "US-303 Posting Time Entry Structure",
                    first_entry,
                    required_fields
                )
                
                # Check constraints
                for entry in posting_times:
                    # dayOfWeek should be 0-6
                    if not (0 <= entry.get("dayOfWeek", -1) <= 6):
                        self.log_test("US-303 DayOfWeek Range", False,
                                    error=f"dayOfWeek {entry.get('dayOfWeek')} not in range 0-6")
                        break
                    
                    # hour should be 0-23
                    if not (0 <= entry.get("hour", -1) <= 23):
                        self.log_test("US-303 Hour Range", False,
                                    error=f"hour {entry.get('hour')} not in range 0-23")
                        break
                    
                    # postCount should be >= 2
                    if entry.get("postCount", 0) < 2:
                        self.log_test("US-303 Min Post Count", False,
                                    error=f"postCount {entry.get('postCount')} < 2")
                        break
                else:
                    self.log_test("US-303 Data Constraints", True)
                
                # Check max 5 entries returned
                if len(posting_times) <= 5:
                    self.log_test("US-303 Max 5 Entries", True)
                else:
                    self.log_test("US-303 Max 5 Entries", False,
                                error=f"Returned {len(posting_times)} entries, max should be 5")
                
                # Check sorted by avgEngagementRate descending
                if len(posting_times) > 1:
                    is_sorted = all(posting_times[i]["avgEngagementRate"] >= posting_times[i+1]["avgEngagementRate"] 
                                  for i in range(len(posting_times)-1))
                    if is_sorted:
                        self.log_test("US-303 Sorted by Engagement Rate", True)
                    else:
                        self.log_test("US-303 Sorted by Engagement Rate", False,
                                    error="Posting times not sorted by avgEngagementRate desc")

        # Test 2: Best posting times for LinkedIn
        success, data = self.run_test(
            "US-303 Best Posting Times (LinkedIn)",
            "GET",
            f"/api/v1/analytics/channels/{self.linkedin_id}/posting-times", 
            200,
            params={
                "start": self.date_start,
                "end": self.date_end
            }
        )

    def test_us304_channel_comparison(self):
        """Test US-304: Channel Comparison"""
        print("\n" + "="*60)
        print("TESTING US-304: Channel Comparison")
        print("="*60)
        
        # Test 1: Compare 2 channels
        success, data = self.run_test(
            "US-304 Compare 2 Channels",
            "GET",
            "/api/v1/analytics/compare",
            200,
            params={
                "channel_ids": f"{self.instagram_id},{self.linkedin_id}",
                "start": self.date_start,
                "end": self.date_end
            }
        )
        
        if success and data:
            self.validate_response_structure(
                "US-304 Response Structure",
                data,
                ["channels", "winners"]
            )
            
            actual_data = data.get('data', data)
            channels = actual_data.get('channels', [])
            winners = actual_data.get('winners', {})
            
            # Validate channel metrics structure
            if channels:
                required_channel_fields = ["channelId", "platform", "displayName", 
                                         "totalImpressions", "totalEngagements", 
                                         "totalPosts", "avgEngagementRate"]
                self.validate_response_structure(
                    "US-304 Channel Metrics Structure",
                    channels[0],
                    required_channel_fields
                )
            
            # Validate winners structure
            required_winner_fields = ["totalImpressions", "totalEngagements", 
                                    "avgEngagementRate", "totalPosts"]
            self.validate_response_structure(
                "US-304 Winners Structure",
                winners,
                required_winner_fields
            )
            
            # Check that winners contain valid channel IDs
            if channels and winners:
                channel_ids = {ch["channelId"] for ch in channels}
                for metric, winner_id in winners.items():
                    if winner_id not in channel_ids:
                        self.log_test(f"US-304 Winner ID Valid ({metric})", False,
                                    error=f"Winner ID {winner_id} not in channel list")
                        break
                else:
                    self.log_test("US-304 Winner IDs Valid", True)

        # Test 2: Single channel (should fail)
        success, data = self.run_test(
            "US-304 Single Channel Error",
            "GET",
            "/api/v1/analytics/compare",
            400,
            params={
                "channel_ids": self.instagram_id,
                "start": self.date_start,
                "end": self.date_end
            }
        )

        # Test 3: Non-existent channel ID
        success, data = self.run_test(
            "US-304 Non-existent Channel",
            "GET",
            "/api/v1/analytics/compare",
            404,
            params={
                "channel_ids": f"{self.instagram_id},507f1f77bcf86cd799439011",
                "start": self.date_start,
                "end": self.date_end
            }
        )

    def run_all_tests(self):
        """Run all Milestone 3 tests"""
        print("🚀 Starting ContentPulse Milestone 3 API Tests")
        print(f"🎯 Base URL: {self.base_url}")
        print(f"📅 Date Range: {self.date_start} to {self.date_end}")
        print(f"📊 Test Channels: Instagram ({self.instagram_id}), LinkedIn ({self.linkedin_id})")
        
        # Run all test suites
        self.test_us301_channel_time_series()
        self.test_us302_content_type_breakdown()
        self.test_us303_best_posting_times()
        self.test_us304_channel_comparison()
        
        # Print summary
        print("\n" + "="*60)
        print("📊 TEST SUMMARY")
        print("="*60)
        print(f"✅ Tests Passed: {self.tests_passed}/{self.tests_run}")
        print(f"❌ Tests Failed: {len(self.failed_tests)}")
        
        if self.failed_tests:
            print("\n🔥 FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"   • {failure['name']}: {failure['error']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"\n📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run


def main():
    # Use the external preview URL from the environment
    base_url = "https://b362c9b3-9998-4d04-89ab-6546e7abbdf5.preview.emergentagent.com"
    
    print("ContentPulse Milestone 3 Backend API Tester")
    print("="*50)
    
    tester = ContentPulseM3Tester(base_url)
    success = tester.run_all_tests()
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())