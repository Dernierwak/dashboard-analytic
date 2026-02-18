from flask import Flask, request, redirect

app = Flask(__name__)

@app.route("/callback")
def callback():
    code = request.args.get("code")
    return redirect(f"http://localhost:8502?code={code}")

if __name__ == "__main__":
    app.run(port=5000, ssl_context="adhoc")
