#!/usr/bin/python3
import os
import json
import requests
import streamlit as st
from streamlit_chat import message

st.set_page_config(page_title="Github Search", layout="wide", initial_sidebar_state="auto")
st.title("Github Search")
st.text_input("Enter Github Username", key="username")

if st.session_state.username is not None:
    username = st.session_state.username

    api = f"https://api.github.com/users/{username}/repos"
    
    search = requests.get(api)
    results = json.loads(search.content)

    for result in results:
        name = result["name"]
        url = result["url"]
        created_at = result["created_at"]
        updated_at = result["updated_at"]
        watchers_count = result["watchers_count"]
        stargazers_count =  result["stargazers_count"]
        watchers = result["watchers"]
        description = result["description"]
        language = result["language"]
        forks_count = result["forks_count"]
        license = result["license"]

        try:
            for license_name in license:
                license_name = license["name"]

        except TypeError:
            license_name = "None"

        st.text(f"{name} : {url}\nDespription : {description}\nLanguage : {language}\nCreated on : {created_at}\nLast update : {updated_at}\nForks : {forks_count}\nStars : {stargazers_count}\nWatchers : {watchers}\nLicence : {license_name}")
        