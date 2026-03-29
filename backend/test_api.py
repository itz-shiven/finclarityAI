import requests
import json

def test_api():
    url = "http://127.0.0.1:5000/api/compare_product"
    
    # We will test using cookies/sessions if possible, but the API requires a logged in user with premium.
    # To bypass it, let's just make a local POST request via requests to the flask app ? 
    # Or, the easiest way to test without messing with sessions is to use the python functions directly
    # Wait, flask test client is easier. Let me just write a simple test script using the app context.
    pass

if __name__ == "__main__":
    from app import app
    from chat import compare_product
    
    with app.test_request_context(
        '/api/compare_product', 
        method='POST', 
        json={"product_name": "AXIS Atlas", "provider": "AXIS", "category": "Cards"}
    ):
        with app.test_client() as c:
            with c.session_transaction() as sess:
                # Mock a premium user session
                sess['user_id'] = 'mock-user-id'
            
            resp = c.post('/api/compare_product', json={"product_name": "AXIS Atlas", "provider": "AXIS", "category": "Cards"})
            print(f"Status: {resp.status_code}")
            print(f"Response: {resp.get_data(as_text=True)}")
