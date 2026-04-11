import streamlit as st
from supabase import Client
import pandas as pd


class Labelling():

    def __init__(self, client: Client, user_id: str, df: pd.DataFrame):
        self.supabase = client
        self.user_id = user_id
        self.df = df
        if "labels_list" not in st.session_state:
            data = self.supabase.table("profiles").select("labelling").eq("id", self.user_id).execute().data
            raw = data[0].get("labelling") if data else []
            st.session_state.labels_list = [l for l in (raw or []) if l]

    def _manage_labels(self):
        st.markdown("#### Tes labels")

        if st.session_state.labels_list:
            st.pills(
                "Labels",
                options=st.session_state.labels_list,
                selection_mode="multi",
                key="pills_display",
                label_visibility="collapsed"
            )
        else:
            st.caption("Aucun label créé.")

        col_input, col_btn = st.columns([4, 1])
        with col_input:
            new_label = st.text_input("Nouveau label", placeholder="Ex: viral, UGC, campagne...", label_visibility="collapsed", key="new_label_input")
        with col_btn:
            if st.button("+ Ajouter", key="btn_add", use_container_width=True):
                if not new_label.strip():
                    st.warning("Label vide.")
                elif new_label.strip() in st.session_state.labels_list:
                    st.warning("Existe déjà.")
                else:
                    st.session_state.labels_list.append(new_label.strip())
                    self.supabase.table("profiles").update({
                        "labelling": st.session_state.labels_list
                    }).eq("id", self.user_id).execute()
                    st.rerun()

        with st.expander("Supprimer ou renommer"):
            to_delete = st.multiselect(
                "Supprimer",
                options=[l for l in st.session_state.labels_list if l],
                key="labels_to_delete"
            )
            if st.button("Supprimer", key="btn_delete"):
                for label in to_delete:
                    st.session_state.labels_list.remove(label)
                self.supabase.table("profiles").update({
                    "labelling": st.session_state.labels_list
                }).eq("id", self.user_id).execute()
                st.rerun()

            st.divider()

            old_labels = st.session_state.labels_list.copy()
            label_df = pd.DataFrame(old_labels, columns=["label"])
            st.data_editor(label_df, hide_index=True, key="label_editor", use_container_width=True)
            if st.button("Sauvegarder les noms", key="btn_rename"):
                editor_state = st.session_state.get("label_editor", {})
                edited_rows = editor_state.get("edited_rows", {})
                new_labels = old_labels.copy()
                for idx_str, changes in edited_rows.items():
                    if "label" in changes:
                        new_labels[int(idx_str)] = changes["label"]
                new_labels = [l for l in new_labels if l]
                st.session_state.labels_list = new_labels
                self.supabase.table("profiles").update({
                    "labelling": new_labels
                }).eq("id", self.user_id).execute()
                for old, new in zip(old_labels, new_labels):
                    if old != new:
                        posts = self.supabase.table("instagram_organic_posts").select("id,labels").eq("user_id", self.user_id).contains("labels", [old]).execute().data
                        for post in posts:
                            updated = [new if l == old else l for l in (post["labels"] or [])]
                            self.supabase.table("instagram_organic_posts").update({"labels": updated}).eq("id", post["id"]).execute()
                clear_fn = st.session_state.get("_posts_cache_clear")
                if clear_fn:
                    clear_fn()
                st.rerun()

    def _edit_labels_column(self):
        """Édition des labels directement dans le tableau — un label par post via SelectboxColumn."""
        if not st.session_state.labels_list:
            st.caption("Crée d'abord des labels dans la section ci-dessus.")
            return

        display_df = self.df[["caption", "type", "date", "labels"]].copy()
        display_df["label"] = display_df["labels"].apply(lambda x: x[0] if x and len(x) > 0 else None)
        display_df = display_df.drop(columns=["labels"])

        edited = st.data_editor(
            display_df,
            column_config={
                "label": st.column_config.SelectboxColumn(
                    "Label",
                    options=[l for l in st.session_state.labels_list if l],
                    required=False,
                ),
                "caption": st.column_config.TextColumn("Caption", disabled=True),
                "type": st.column_config.TextColumn("Type", disabled=True),
                "date": st.column_config.TextColumn("Date", disabled=True),
            },
            hide_index=True,
            use_container_width=True,
            key="editor_label_col"
        )

        if st.button("Sauvegarder les labels", key="btn_save_col"):
            with st.spinner("Mise à jour..."):
                for i, row in edited.iterrows():
                    post_id = self.df["id"].iloc[i]
                    label = row["label"]
                    new_labels = [label] if label else []
                    self.supabase.table("instagram_organic_posts").update({
                        "labels": new_labels
                    }).eq("user_id", self.user_id).eq("id", post_id).execute()
            st.success("Sauvegardé.")

    # def _assign_labels_batch(self, selected):
    #     """Mode batch — sélectionner plusieurs posts et assigner les mêmes labels."""
    #     chosen = st.pills(
    #         "Choisir les labels",
    #         options=[l for l in st.session_state.labels_list if l] + ["None"],
    #         selection_mode="multi",
    #         key="pills_assign",
    #         label_visibility="collapsed"
    #     )
    #     if selected.selection.rows:
    #         st.session_state["selected_rows"] = selected.selection.rows
    #     saved_rows = st.session_state.get("selected_rows", [])
    #     if st.button("Appliquer", key="btn_assign"):
    #         for row_idx in saved_rows:
    #             post_id = self.df["id"].iloc[row_idx]
    #             old_labels = self.df["labels"].iloc[row_idx] or []
    #             new_labels = [] if "None" in chosen else list(set(old_labels + chosen))
    #             self.df["labels"].iloc[row_idx] = new_labels
    #             self.supabase.table("instagram_organic_posts").update({
    #                 "labels": new_labels
    #             }).eq("user_id", self.user_id).eq("id", post_id).execute()
    #         st.session_state["selected_rows"] = []
    #         st.success("Labels mis à jour.")


# == DEBUG ==

if __name__ == "__main__":
    url = st.secrets.supabase.url
    token = st.secrets.supabase.service_role
    user_id = "11043e9a-fc29-4c71-a67b-6816a6ea2e78"
    client = Client(supabase_url=url, supabase_key=token)

    data = client.table("instagram_organic_posts").select("*").eq("user_id", user_id).execute().data
    df = pd.DataFrame(data)
    cols = ["labels"] + [c for c in df.columns if c != "labels"]
    df = df[cols]

    labelling = Labelling(client, user_id, df)
    labelling._manage_labels()
    st.divider()
    labelling._edit_labels_column()
